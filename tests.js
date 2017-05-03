var tests = {
	responseCode: function(idx, condition, response) {
		if (condition.hasOwnProperty("exact"))
		{
			var result = response.responseCode == condition.exact;
			logger.debug(`[${idx}] responseCode test for exact code ${condition.exact} ${((result) ? "passed" : "failed")} with input code of ${response.responseCode}`);

			return result;
		}
		else if (condition.hasOwnProperty("series"))
		{
			var result = response.responseCode.toString().substring(0,1) == condition.series.substring(0,1);
			logger.debug(`[${idx}] responseCode test for series ${condition.series} ${((result) ? "passed" : "failed")} with input code of ${response.responseCode}`);

			return result;
		}
	},
	notResponseCode: function(idx, condition, response) {
		if (condition.hasOwnProperty("exact"))
		{
			logger.debug(`[${idx}] Executing notResponseCode test for exact code ${condition.exact} with input code of ${response.responseCode}`);
			return response.responseCode != condition.exact;
		}
		else if (condition.hasOwnProperty("series"))
		{
			logger.debug(`[${idx}] Executing notResponseCode test for series ${condition.series} with input code of ${response.series}`);
			return response.resposnecode.substring(0,1) != condition.series.substring(0,1);
		}
	},
	responseSize: function(idx, condition, response) {
		if (condition.minimum !== 0 && condition.minimum !== undefined && condition.maximum !== 0 && condition.maximum !== undefined)
		{
			logger.debug(`[${idx}] Executing responseSize test with minimum of ${condition.minimum} and maximum of ${condition.maximum} on response size of ${response.responseData.length}`);
			return response.responseData.length > condition.minimum && response.responseData.length < condition.maximum;
		}
		else if (condition.minimum !== 0 && condition.minimum !== undefined)
		{
			logger.debug(`[${idx}] Executing responseSize test with minimum of ${condition.minimum} and no maximum on response size of ${response.responseData.length}`);
			return response.responseData.length > condition.minimum;
		}
		else if (condition.maximum !== 0 && condition.maximum !== undefined)
		{
			logger.debug(`[${idx}] Executing responseSize test with no minimum and maximum of ${condition.maximum} on response size of ${response.responseData.length}`);
			return response.responseData.length < condition.maximum;
		}
	},
	contentMatch: function(idx, condition, response) {
		var result = true;

		logger.debug(`[${idx}] Executing contentMatch test against terms "${condition.matches}"`);

		// Iterate over the strings to match for; if any fail, result will be set to false
		condition.matches.forEach((match) => {
			var loc = response.responseData.indexOf(match);

			if (loc === -1)
			{
				result = false;
				logger.debug(`[${idx}] contentMatch test failed against term "${match}": ${response.responseData.indexOf(match)}`);
			}
			else
				logger.debug(`[${idx}] contentMatch test passed against term "${match}", found at location ${loc}`);
		});

		return result;
	}
};

module.exports = tests;