const dayjs = require('dayjs')
const uuid = require('uuid')
const duration = require('dayjs/plugin/duration')
const colors = require('colors')
const prompt = require('prompt')
const fs = require('fs')
dayjs.extend(duration)
require('dotenv').config({ path: __dirname + '/../config.env' })

const libre = require('./functions/libre')
const nightscout = require('./functions/nightscout')
const { log } = require('console')
let newSensor = false

const CONFIG_NAME = 'config.json'
const DEFAULT_CONFIG = {}

if (!fs.existsSync(CONFIG_NAME)) {
  fs.writeFileSync(CONFIG_NAME, JSON.stringify(DEFAULT_CONFIG))
}

const rawConfig = fs.readFileSync(CONFIG_NAME)
let config = JSON.parse(rawConfig)

// if (Object.keys(config).length === 0) {
//   prompt.get([{
//     name: 'nightscoutUrl',
//     description: 'please enter your nightscout url',
//     required: true,
//     default: config.nightscoutUrl
//   }, {
//     name: 'nightscoutToken',
//     description: 'please enter your nightscout token',
//     required: false,
//     default: config.nightscoutToken
//   }, {
//     name: 'libreUsername',
//     description: 'please enter your libreview username',
//     required: true,
//     default: config.libreUsername
//   }, {
//     name: 'librePassword',
//     description: 'please enter your libreview password',
//     required: true,
//     default: config.librePassword
//   }, {
//     name: 'year',
//     description: 'please enter the year you want to transfer to libreview',
//     required: true,
//     type: 'number',
//     default: new Date().getFullYear()
//   }, {
//     name: 'month',
//     description: 'please enter the month you want to transfer to libreview',
//     required: true,
//     type: 'number',
//     default: new Date().getMonth() + 1
//   }, {
//     name: 'day',
//     description: 'please enter the day you want to transfer to libreview',
//     required: true,
//     type: 'number',
//     default: new Date().getDate()
//   }, {
//     name: 'count',
//     description: 'please enter amount of days before you want to transfer to libreview',
//     required: true,
//     type: 'number',
//     default: 1
//   }, {
//     name: 'libreResetDevice',
//     description: 'if you have problems with your transfer, recreate your device id',
//     required: true,
//     type: 'boolean',
//     default: false
//   }], function (err, result) {
//     if (err) {
//       return onErr(err);
//     }
const sensorDate = dayjs(config.newSensorDate) // дата след. установки датчика
const setupDate = dayjs(config.setupDate) // дата последней установки датчика
const toDate = dayjs(new Date())

const difsetup = dayjs.duration(toDate.diff(setupDate)).asDays()
const difs = dayjs.duration(sensorDate.diff(toDate)).asDays()

if (difs < 1 && difsetup > 1 && config.newSensorEnabled == '1') {
  const h = nightscout.randomInt(10, 20) // время устоановки следующего датчика

  if (
    toDate.format('HH') >= sensorDate.hour() - 1 &&
    toDate.format('HH') <= sensorDate.hour() + 1
  ) {
    newSensor = true
    const newSensorDate = toDate
      .add(config.sensorDays, 'days')
      .hour(h)
      .format('YYYY-MM-DDTHH:mm:ss')

    config = Object.assign({}, config, {
      newSensorDate: newSensorDate, // новая дата установки датчика
      setupDate: toDate.format('YYYY-MM-DD') // дата последней установки датчика
    })
    //  fs.writeFileSync(CONFIG_NAME, JSON.stringify(config));
  }
}

;(async () => {
  const offset = dayjs().utcOffset()
  let needPoints = true
  const toDate = dayjs(new Date())
    .subtract(offset, 'minute')
    .format('YYYY-MM-DDTHH:mm:ss') // текущее время

  fromDate = dayjs(toDate)
    .startOf('day')
    .subtract(offset, 'minute')
    .format('YYYY-MM-DDTHH:mm:ss') // от начала дня

  if (newSensor) {
    // если новый сенсор, то берём за 15 минут до текущего времени
    fromDate = dayjs(toDate)
      .subtract(15, 'minute')
      .format('YYYY-MM-DDTHH:mm:ss')
    needPoints = false // ставить точки не нужно
  }

  // const h = dayjs(new Date()).hour()
  // if (h <= 5) {
  //   needPoints = false // ставить точки не нужно
  //   fromDate = dayjs(toDate).subtract(24, 'hour').format('YYYY-MM-DDTHH:mm:ss') // берём сутки для заполнения возможных пробелов
  // }

  console.log('transfer time span', fromDate.gray, '-', toDate.gray)

  const allData = await nightscout.getNightscoutAllEntries(
    config.nightscoutUrl,
    config.nightscoutToken,
    fromDate,
    toDate,
    parseInt(config.min_count),
    parseInt(config.max_count),
    needPoints
  )

  if (
    allData.glucoseEntriesScheduled.length > 0 ||
    allData.foodEntries.length > 0 ||
    allData.insulinEntries.length > 0
  ) {
    const auth = await libre.authLibreView(
      config.libreUsername,
      config.librePassword,
      config.libreDevice,
      config.libreResetDevice
    )
    if (!!!auth) {
      console.log('libre auth failed!'.red)
      return
    }

    await libre.transferLibreView(
      config.libreDevice,
      auth,
      allData.glucoseEntriesScheduled,
      allData.glucoseEntriesUnscheduled,
      allData.foodEntries,
      allData.insulinEntries
    )
    if (newSensor) {
      await libre.transferNewSensorLibreView(config.libreDevice, auth, fromDate) //корректируем время UTC
    }
    fs.writeFileSync(CONFIG_NAME, JSON.stringify(config))
  } else {
    console.log('No entries'.blue)
  }
})()
// });

function onErr (err) {
  console.log(err)
  return 1
}
