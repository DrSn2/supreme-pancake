var http = require("http");
var https = require("https");
var colors = require("colors");
var dateFormat = require("dateformat");
var fs = require("fs");
var now = require("performance-now");
var winston = require("winston");
var testFunctions = require("./tests.js");
var Validator = require('jsonschema').Validator;
var v = new Validator();
var configSchema = require("./configSchema.json");
var configFilename = "config.json";
var configData;
var configuration;
var tests = [];

function LoadConfigurationData(configFilename) {
	logger.info(`Configuration file is ${configFilename}`);
	logger.silly(`Attempting to load configuration data from file ${configFilename}`);

	// Check that the specified configuration file exists
	if (!fs.existsSync(configFilename))
	{
		logger.error(`Configuration file ${configFilename} does not exist, terminating.`);;
		process.exit(1);
	}
	else {
		// Read the contents of the configuration file
		try {
			var configData = fs.readFileSync(configFilename, "utf-8");
		}
		catch (err) {
			// We got an error of some sort reading the file, bail out
			logger.error(`Error reading contents of configuration file ${configFilename}, exiting.`, err);
			process.exit(1);
		}

		// Test file length
		if (configData.length === 0)
		{
			// The configuration file contains no data
			logger.error(`Configuration file ${configFilename} contains no data, exiting.`);
			process.exit(1);
		}
		else {
			// Attempt to parse the configuration data
			try {
				return JSON.parse(configData);
			}
			catch (err) {
				// Error parsing the configuration data as JSON
				logger.error(`Error parsing configuration file ${configFilename} as JSON, exiting.`, err);
				process.exit(1);
			}
		}
	}

	logger.silly(`Configuration data loaded from file ${configFilename}`);
}

function ValidateConfigurationData(config) {
	logger.silly(`Validating ${JSON.stringify(config).length} bytes of configuration data.`);

	// Configuration must contain a version as a top-level key, otherwise we don't know what to validate against
	if (!config.hasOwnProperty("version"))
	{
		logger.error("Configuration object missing \"version\" key, cannot validate. Exiting.");
		process.exit(1);
	}
	else
	{
		// Determine the config object version
		switch (config.version) {
			case 1:
				logger.debug("Configuration object is version 1.");
				logger.silly("Validating configuration object against version 1 schema.");

				// Validate the configuration data against the schema
				var result = v.validate(config, configSchema);

				if (result.valid)
				{
					logger.silly("Configuration object passes validation.");
					return true;
				}
				else
				{
					logger.error("Configuration object failed schema validation, exiting.");
					process.exit(1);
				}
				break;
			default:
				// Unexpected version number found in file
				logger.error(`Configuration object identifies itself as version ${config.version}, an unknown version.`);
				break;
		}
	}
}

// Processes the incoming commandline arguments and acts on the values passed
function ParseCommandLine(argv) {
	logger.info(`Execution commandline: ${argv.join(" ")}`);
	logger.debug("Parsing " + ((argv.length - 2) / 2).toFixed(0) + " command line switches");

	for(i = 2;i<argv.length;i++)
	{
		switch(argv[i].toLowerCase()) {
			case "--config":
				logger.debug(`Overriding default configuration filename with passed value ${argv[i+1].toLowerCase()}`);
				configFilename = argv[i+1].toLowerCase();
				break;
			default:
				logger.warn(`Unknown command-line parameter passed: ${argv[i].toLowerCase()}`);
				break;
		}

		i++;
	}
}

// Object prototype for holding responses from remote servers
function WebResponse() {
	this.responseCode = 0;
	this.responseData = "";
	this.responseTime = 0;
}

// Object prototype for holding test configuration
function Test(testFromConfig, idx) {
	this.idx = idx;
	this.name = testFromConfig.name;
	this.friendlyName = testFromConfig.friendlyName;
	this.url = testFromConfig.url;
	// Polling interval is stored in seconds in the configuration, convert to milliseconds.
	this.pollingInterval = testFromConfig.pollingInterval * 1000;
	this.successCondition = testFromConfig.successCondition;
	this.ExecuteTest = () => {
		logger.info(`[${this.idx}] Executing test ${this.friendlyName}`);

		var result = RequestUrl(this, ProcessTestResponse);
	};
}

function SetConfiguration(config, callback) {
	var idx = 0;

	logger.silly("Setting configuration variables from configuration object");

	// Store the configuration in a global var for use elsewhere
	configuration = config;

	// Check to see if logging should be shut off
	if (configuration.hasOwnProperty("logging") && configuration.logging.hasOwnProperty("enabled") && !configuration.logging.enabled)
	{
		logger.info("Disabling logging as per configuration");

		// Remove the console logger
		logger.remove(winston.transports.Console);
	}
	else {
		// Check if we should be logging to console
		if (configuration.hasOwnProperty("logging") && configuration.logging.hasOwnProperty("consoleLogging") && configuration.logging.consoleLogging)
		{
			// Override the default console level if specified
			if (configuration.hasOwnProperty("logging") && configuration.logging.hasOwnProperty("consoleLoggingLevel"))
			{
				logger.info(`Setting console logging level to ${configuration.logging.consoleLoggingLevel} as per configuration`);

				// Just remove the console logger and readd it, seems simplest
				logger.remove(winston.transports.Console)
				.add(winston.transports.Console, {
					level: configuration.logging.consoleLoggingLevel,
					timestamp: function() {
							return dateFormat(Date.now(), "HH:MM:ss");
						},
						formatter: function(options) {
							// Return string will be passed to logger.
							return options.timestamp() +' '+ options.level.toUpperCase() +' '+ (options.message ? options.message : '') +
							(options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
						}
					}
				);
			}
		}

		// Check if we should enable file logging
		if (configuration.hasOwnProperty("logging") && configuration.logging.hasOwnProperty("fileLogging") && configuration.logging.fileLogging)
		{
			// Check for a logging level override; default otherwise
			var fileLoggingLevel = (configuration.hasOwnProperty("logging") && configuration.logging.hasOwnProperty("fileLoggingLevel")) ? configuration.logging.fileLoggingLevel : "info";

			// Check for a log filename override; default otherwise
			var fileLoggingFile = (configuration.hasOwnProperty("logging") && configuration.logging.hasOwnProperty("fileLoggingFile")) ? configuration.logging.fileLoggingFile : "log.txt";

			logger.info(`Enabling file logging at level ${fileLoggingLevel} to file ${fileLoggingFile}`);

			// Add a file logger
			logger.add(winston.transports.File, {
				level: fileLoggingLevel,
				filename: fileLoggingFile,
				json: false,
				timestamp: function() {
					return dateFormat(Date.now(), "HH:MM:ss");
				},
				formatter: function(options) {
					// Return string will be passed to logger.
					return options.timestamp() +' '+ options.level.toUpperCase() +' '+ (options.message ? options.message : '') +
					(options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
				}
			});
		}

		logger.info(`Application finished initializing at ${dateFormat(Date.now(), "d mmm yyyy HH:MM:ss")}, beginning normal operation.`);
	}

	// Loop over the array of tests, adding them to the tests array
	config.tests.forEach((value) => {
		idx++;

		logger.debug("Configuring test " + value.friendlyName);

		tests.push(new Test(value, idx));
	});

	logger.debug(`${tests.length} tests configured.`);
	logger.silly("Finished setting configuration variables.");

	// Execute the callback function
	if (callback !== undefined)
		callback();
}

function RequestUrl(test, callback) {
	var proto = http;
	var response = new WebResponse();
	var data;

	var t0 = now();

	logger.debug(`[${test.idx}] Requesting ${test.url}`);

	// Switch proto to https if appropriate
	if (test.url.startsWith("https://")) proto = https;

	proto.get(test.url, (res) => {
		logger.debug(`[${test.idx}] Response received with status code ${res.statusCode}`);

		// Store the response code
		response.responseCode = res.statusCode;

		// Retrieve data
		res.setEncoding("utf-8");
		res.on("data", (chunk) => { data += chunk });
		res.on("end", () => {
			response.responseData = data;
			response.responseTime = (now() - t0).toFixed(0);

			logger.debug(`[${test.idx}] Response data received totaling ${response.responseData.length} bytes`);

			// Execute the callback
			callback(test, response);
		});
		// As far as I can tell from the documentation this _should_ catch errors making the request, but doesn't...
		res.on("error", (e) => {
			logger.warn(`[${test.idx}] Error requesting ${test.url}:`, e);
		});
	});
}

// Initialize the logger - logger will always begin with console logging, if the app is configured not to log it will be shut off later
logger = new winston.Logger({
	level: "debug",
	transports: [
		new (winston.transports.Console)({
			timestamp: function() {
				return dateFormat(Date.now(), "HH:MM:ss");
			},
			formatter: function(options) {
				// Return string will be passed to logger.
				return options.timestamp() +' '+ options.level.toUpperCase() +' '+ (options.message ? options.message : '') +
				(options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
			}
		})
	]
});

// Log
logger.info("Logger initialized");

// Parse command-line arguments
ParseCommandLine(process.argv);

// Load the configuration
configData = LoadConfigurationData(configFilename);

// Validate the configuration data
if (ValidateConfigurationData(configData))
	// Load the configuration
	config = SetConfiguration(configData, () => {
			// Loop over each test, scheduling it to run on its polling interval
			for(i = 0;i<tests.length;i++) {
				var test = tests[i];

				// Schedule each test to run on its pollingInterval
				setInterval(test.ExecuteTest.bind(test), test.pollingInterval);

				logger.debug(`Test ${test.friendlyName} scheduled with an interval of ${test.pollingInterval / 1000} seconds.`);

				// Mnaually fire each test to run immediately
				test.ExecuteTest();
			}
	});

function ProcessTestResponse(test, response) {
	logger.debug(`[${test.idx}] Processing response of test ${test.friendlyName} with ${response.responseData.length} bytes of data and a ${response.responseCode} status code.`);
	logger.debug(`[${test.idx}] Testing ${test.successCondition.length} conditions on the response`);

	// Execute the specified tests on the response data
	var responseTests = [];
	var success = true;

	var overallTestResult = true;

	// Execute tests
	test.successCondition.forEach((condition) => {
		var testResult = true;

		// Execute the test
		if (condition.type == "responseCode")
			testResult = testFunctions.responseCode(test.idx, condition, response);
		else if (condition.type == "responseSize")
			testResult = testFunctions.responseSize(test.idx, condition, response);
		else if (condition.type == "contentMatch")
			testResult = testFunctions.contentMatch(test.idx, condition, response);

		// Check the result; if it's false, set overallRestResult to false because a failure of any condition is a failure of the entire test
		if (!testResult)
			overallTestResult = false;
	});

	if (overallTestResult)
		logger.info(`Test ${test.friendlyName} completed with overall result of ${overallTestResult}`);
	else
		logger.warn(`Test ${test.friendlyName} completed with overall result of ${overallTestResult}`);
}