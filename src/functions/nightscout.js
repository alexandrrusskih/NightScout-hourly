const axios = require('axios');
const dayjs = require('dayjs');
const colors = require('colors');
const utc = require('dayjs/plugin/utc')
dayjs.extend(utc);

const getNightscoutToken = function (token) {
  if (token.trim() !== '') {
    return `&token=${token.trim()}`
  }

  return '';
};

const getNightscoutAllEntries = async function (baseUrl, token, fromDate, toDate) {
	
  const url = `${baseUrl}/api/v1/entries.json?find[dateString][$gte]=${fromDate}&find[dateString][$lt]=${toDate}&count=131072${getNightscoutToken(token)}`;
  console.log('glucose entries url', url.gray);

  const response = await axios.get(url, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  console.log('glucose entries read:', (response.data || []).length.toString());
  const utcOffset = response.data[0].utcOffset;
  console.log('UTC Offset:', utcOffset.toString());
  const dataGlucose = response.data.filter((value, index, Arr) => index % 2 == 0).map(d => {
	
	const dateStringLocal = dayjs.utc(d.dateString).utcOffset(utcOffset);
	const sysTimeLocal = dayjs.utc(d.sysTime).utcOffset(utcOffset);
	
	return {
      "extendedProperties": {
        "highOutOfRange": d.sgv >= 400 ? "true" : "false",
        "canMerge": "true",
        "isFirstAfterTimeChange": false,
        "factoryTimestamp": sysTimeLocal.format(),
        "lowOutOfRange": d.sgv <= 40 ? "true" : "false"
      },
      "recordNumber": parseInt(`1${dateStringLocal.format('YYYYMMDDHHmmss')}`),
      "timestamp": dateStringLocal.format(),
      "valueInMgPerDl": d.sgv
    };	
  });
	
  const url1 = `${baseUrl}/api/v1/treatments.json?find[created_at][$gte]=${fromDate}&find[created_at][$lt]=${toDate}&find[carbs][$gt]=0&count=131072${getNightscoutToken(token)}`;
  console.log('food entries url', url1.gray);

  const response1 = await axios.get(url1, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  console.log('food entries read:', (response1.data || []).length.toString());
  const dataFood =  response1.data.map(d => {

	const created_at_Local = dayjs.utc(d['created_at']).utcOffset(utcOffset);
	
    return {
      extendedProperties: {
			factoryTimestamp: created_at_Local.format()
	  },
	  recordNumber: parseInt(`2$created_at_Local.format('YYYYMMDDHHmmss')}`),
	  timestamp: created_at_Local.format(),
	  gramsCarbs: d.carbs,
	  foodType: "Unknown"
    };
  });
  
  const url2 = `${baseUrl}/api/v1/treatments.json?find[created_at][$gte]=${fromDate}&find[created_at][$lt]=${toDate}&find[insulin][$gt]=0&count=131072${getNightscoutToken(token)}`;
  console.log('insulin entries url', url2.gray);

  const response2 = await axios.get(url2, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  console.log('insulin entries read:', (response2.data || []).length.toString());
  const dataInsulin = response2.data.map(d => {
	
	const created_at_Local = dayjs.utc(d['created_at']).utcOffset(utcOffset);
	
	return {
      extendedProperties: {
        factoryTimestamp: created_at_Local.format()
      },
      recordNumber: parseInt(`4$created_at_Local.format('YYYYMMDDHHmmss')}`),
      timestamp: created_at_Local.format(),
      units: d.insulin,
      insulinType: "RapidActing"
    };
  });  
 
  return {glucoseEntries:dataGlucose,foodEntries:dataFood,insulinEntries:dataInsulin};
};

exports.getNightscoutAllEntries = getNightscoutAllEntries;
