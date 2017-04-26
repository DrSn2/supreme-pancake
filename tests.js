var tests = {
	responseCode: function(condition, response) {
		if (condition.hasOwnProperty("exact"))
		{
			console.log(`Executing responseCode test for exact code ${condition.exact} with input code of ${response.responseCode}`);
			return response.responseCode == condition.exact;
		}
		else if (condition.hasOwnProperty("series"))
		{
			console.log(`Executing responseCode test for series ${condition.series} with input code of ${response.series}`);
			return response.responseCode.substring(0,1) == condition.series.substring(0,1);
		}
	},
	notResponseCode: function(condition, response) {
		if (condition.hasOwnProperty("exact"))
		{
			console.log(`Executing notResponseCode test for exact code ${condition.exact} with input code of ${response.responseCode}`);
			return response.responseCode != condition.exact;
		}
		else if (condition.hasOwnProperty("series"))
		{
			console.log(`Executing notResponseCode test for series ${condition.series} with input code of ${response.series}`);
			return response.resposnecode.substring(0,1) != condition.series.substring(0,1);
		}
	},
	responseSize: function(condition, response) {
		if (condition.minimum !== 0 && condition.minimum !== undefined && condition.maximum !== 0 && condition.maximum !== undefined)
		{
			console.log(`Executing responseSize test with minimum of ${condition.minimum} and maximum of ${condition.maximum} on response size of ${response.responseData.length}`);
			return response.responseData.length > condition.minimum && response.responseData.length < condition.maximum;
		}
		else if (condition.minimum !== 0 && condition.minimum !== undefined)
		{
			console.log(`Executing responseSize test with minimum of ${condition.minimum} and no maximum on response size of ${response.responseData.length}`);
			return response.responseData.length > condition.minimum;
		}
		else if (condition.maximum !== 0 && condition.maximum !== undefined)
		{
			console.log(`Executing responseSize test with no minimum and maximum of ${condition.maximum} on response size of ${response.responseData.length}`);
			return response.responseData.length < condition.maximum;
		}
	}
};

module.exports = tests;