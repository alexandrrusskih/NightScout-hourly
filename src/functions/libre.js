const crypto = require('crypto');
const axios = require('axios');
const dayjs = require('dayjs');
const colors = require('colors');

const authLibreView = async function (username, password, device, setDevice) {
  console.log('authLibreView'.blue);

  const data = {
    DeviceId: device,
    GatewayType: "FSLibreLink.iOS",
    SetDevice: setDevice,
    UserName: username,
    Domain: "Libreview",
    Password: password
  };

  const response = await axios.default.post('https://api.libreview.ru/lsl/api/nisperson/getauthentication', data, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  console.log('authLibreView, response', JSON.stringify(response.data,null, 4).gray);

  if (response.data.status !== 0) {
    return;
  }

  return response.data.result.UserToken;
}

const transferLibreView = async function (device, token, glucoseEntriesScheduled, glucoseEntriesUnscheduled, foodEntries, insulinEntries) {
  console.log('transferLibreView'.blue);

  console.log('glucose entries scheduled', (glucoseEntriesScheduled || []).length.toString().gray);
  console.log('glucose entries unscheduled', (glucoseEntriesUnscheduled || []).length.toString().gray);
  console.log('food entries', (foodEntries || []).length.toString().gray);
  console.log('insulin entries', (insulinEntries || []).length.toString().gray);
 
  const data = {
    UserToken: token,
    GatewayType: "FSLibreLink.iOS",
    DeviceData: {
      header: {
        device: {
          hardwareDescriptor: "iPhone14,2",
          osVersion: "15.4.1",
          modelName: "com.freestylelibre.app.ru",
          osType: "iOS",
          uniqueIdentifier: device,
          hardwareName: "iPhone"
        }
      },
      measurementLog: {
        capabilities: [
          "scheduledContinuousGlucose",
          "unscheduledContinuousGlucose",
          "bloodGlucose",
          "insulin",
          "food",
          "generic-com.abbottdiabetescare.informatics.exercise",
          "generic-com.abbottdiabetescare.informatics.customnote",
          "generic-com.abbottdiabetescare.informatics.ondemandalarm.low",
          "generic-com.abbottdiabetescare.informatics.ondemandalarm.high",
          "generic-com.abbottdiabetescare.informatics.ondemandalarm.projectedlow",
          "generic-com.abbottdiabetescare.informatics.ondemandalarm.projectedhigh",
          "generic-com.abbottdiabetescare.informatics.sensorstart",
          "generic-com.abbottdiabetescare.informatics.error",
          "generic-com.abbottdiabetescare.informatics.isfGlucoseAlarm",
          "generic-com.abbottdiabetescare.informatics.alarmSetting"
        ],
        bloodGlucoseEntries: [],
        genericEntries: [],
        scheduledContinuousGlucoseEntries: glucoseEntriesScheduled || [],
        insulinEntries: insulinEntries || [],
        foodEntries: foodEntries || [],
        unscheduledContinuousGlucoseEntries: glucoseEntriesUnscheduled || []
      }
    },
    Domain: "Libreview"
  };
    
  const response = await axios.default.post('https://api.libreview.ru/lsl/api/measurements', data, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  console.log('transferLibreView, response', JSON.stringify(response.data,null, 4).gray);  
};

exports.authLibreView = authLibreView;
exports.transferLibreView = transferLibreView;
