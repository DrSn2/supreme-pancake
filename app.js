var http = require("http");
var https = require("https");
var colors = require("colors");
var dateFormat = require("dateformat");
var fs = require("fs");
var now = require("performance-now");
var async = require("async");
var testFunctions = require("./tests.js");
var Validator = require('jsonschema').Validator;
var v = new Validator();
var configSchema = require("./configSchema.json");
var configFilename = "config.json";
var configData;
var configuration;
var tests = [];

function LoadConfigurationData(configFilename) {
	console.log("Loading configuration file " + configFilename);

	// Load the configuration file
	if (!fs.existsSync(configFilename))
	{
		// Configuration file does not exist
		console.log("FATAL".red + ": Configuration file config.js does not exist, exiting.");
		process.exit(1);
	}
	else {
		// Read the config file and parse as JSON
		try {
			var configData = fs.readFileSync(configFilename, "utf-8");
		}
		catch (err) {
			console.log("FATAL".red + `: Error reading configuration file config.js:\n${err}`);
			process.exit(1);
		}

		// Test file length
		if (configData.length === 0)
		{
			console.log("FATAL".red + ": No configuration data found in file config.js, exiting.");
			process.exit(1);
		}
		else {
			// Parse the configuration data
			try {
				return JSON.parse(configData);
			}
			catch (err) {
				console.log("FATAL".red + `: Error parsing configuration data:\n${err}`);
				process.exit(1);
			}
		}
	}
}

function ValidateConfigurationData(config) {
	console.log("Validating " + JSON.stringify(config).length + " bytes of configuration data from " + configFilename);

	// Configuration must contain a version as a top-level key, otherwise we don't know what to validate against
	if (!config.hasOwnProperty("version"))
	{
		console.log("FATAL".red + ": Configuration file missing 'version' key, cannot validate. Exiting.");
		process.exit(1);
	}
	else
	{
		switch (config.version) {
			case 1:
				console.log("Validating configuration file version 1");

				// Validate the configuration data against the schema
				var result = v.validate(config, configSchema);

				if (result.valid)
					return true;
				else
				{
					console.log("FATAL".red + ": Configuration data is invalid, exiting.");
					process.exit(1);
				}
				break;
			default:
				console.log("FATAL".red + `: Unknown configuration version number ${config.version} found in config file.`);
				break;
		}
	}
}

function ParseCommandLine(argv) {
	console.log("Parsing " + (argv.length - 2) / 2 + " command line switches");

	for(i = 2;i<argv.length;i++)
	{
		switch(argv[i].toLowerCase()) {
			case "--config":
				console.log("Overriding default configuration filename with passed value " + argv[i+1].toLowerCase());
				configFilename = argv[i+1].toLowerCase();
				break;
			default:
				console.log("Unknown command-line parameter passed: " + argv[i].toLowerCase());
				break;
		}

		i++;
	}
}

function WebResponse() {
	this.responseCode = 0;
	this.responseData = "";
	this.responseTime = 0;
}

function Test(testFromConfig, idx) {
	this.idx = idx;
	this.name = testFromConfig.name;
	this.friendlyName = testFromConfig.friendlyName;
	this.url = testFromConfig.url;
	this.pollingInterval = testFromConfig.pollingInterval * 1000;
	this.successCondition = testFromConfig.successCondition;
	this.ExecuteTest = () => {
		console.log(`Executing test ${this.friendlyName} with url ${this.url}`);

		var result = RequestUrl(this, ProcessTestResponse);
	};
}

function SetConfiguration(config, callback) {
	var idx = 0;

	// Store the configuration in a global var for use elsewhere
	configuration = config;

	// Loop over the array of tests, adding them to the tests array
	config.tests.forEach((value) => {
		idx++;

		console.log("Setting up test " + value.friendlyName);

		tests.push(new Test(value, idx));
	});

	// Execute the callback function
	if (callback !== undefined)
		callback();
}

function RequestUrl(test, callback) {
	var proto = http;
	var response = new WebResponse();
	var data;

	var t0 = now();

	console.log(`Requesting ${test.url} for test ${test.name}...`);

	// Switch proto to https if appropriate
	if (test.url.startsWith("https://")) proto = https;

	proto.get(test.url, (res) => {
		// Store the response code
		response.responseCode = res.statusCode;

		// Retrieve data
		res.setEncoding("utf-8");
		res.on("data", (chunk) => { data += chunk });
		res.on("end", () => {
			response.responseData = data;
			response.responseTime = (now() - t0).toFixed(0);

			// Execute the callback
			callback(test, response);
		});
	});
}

// Parse command-line arguments
ParseCommandLine(process.argv);

// Load the configuration
configData = LoadConfigurationData(configFilename);

// Validate the configuration data
if (ValidateConfigurationData(configData))
	// Load the configuration
	config = SetConfiguration(configData, () => {
			console.log(`There are ${tests.length} tests.`);

			// Loop over each test, scheduling it to run on its polling interval
			for(i = 0;i<tests.length;i++) {
				var test = tests[i];

				// Schedule each test to run on its pollingInterval
				setInterval(test.ExecuteTest.bind(test), test.pollingInterval);
				//setInterval(() => { ExecuteTest(tests[i]) }, tests[i].pollingInterval);

				// Mnaually fire each test to run immediately
				test.ExecuteTest();
			}
	});

function ProcessTestResponse(test, response) {
	console.log(`Request for test ${test.name} completed in ${response.responseTime}ms, returned ${response.responseData.length} bytes of data.`);

	// Execute the specified tests on the response data
	var responseTests = [];
	var success = true;

	var overallTestResult = true;

	// Execute tests
	test.successCondition.forEach((condition) => {
		var testResult = true;

		// Execute the test
		if (condition.type == "responseCode")
			testResult = testFunctions.responseCode(condition, response);
		else if (condition.type == "responseSize")
			testResult = testFunctions.responseSize(condition, response);

		// Check the result; if it's false, set overallRestResult to false because a failure of any condition is a failure of the entire test
		if (!testResult)
			overallTestResult = false;
	});

if (overallTestResult)
	console.log("Test " + test.friendlyName + " completed with result " + overallTestResult.toString().green);
else
	console.log("Test " + test.friendlyName + " completed with result " + overallTestResult.toString().red);
}

function logResult(consoleData, fileData) {
	if (fileData === undefined)
		fileData = consoleData;

	// Log to console
	console.log(`[${dateFormat(new Date(), "HH:MM:ss")}]: ${consoleData}`);

	// Log to file
	fs.appendFileSync("./log.txt", `[${dateFormat(new Date(), "HH:MM:ss")}]: ${fileData}\n`);
}