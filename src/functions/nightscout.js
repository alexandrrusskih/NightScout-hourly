const axios = require('axios')
const dayjs = require('dayjs')
const duration = require('dayjs/plugin/duration')
const colors = require('colors')
const utc = require('dayjs/plugin/utc')
const { config } = require('dotenv')
dayjs.extend(utc)
dayjs.extend(duration)

const getNightscoutToken = function (token) {
  if (token.trim() !== '') {
    return `&token=${token.trim()}`
  }

  return ''
}

const randomInt = function (min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const getDirection = function (value) {
  switch (value) {
    case 'FortyFiveDown':
    case 'SingleDown':
    case 'DoubleDown':
    case 'TripleDown':
      return 'Falling'

    case 'FortyFiveUp':
    case 'SingleUp':
    case 'DoubleUp':
    case 'TripleUp':
      return 'Rising'

    case 'Flat':
    default:
      return 'Stable'
  }
}

const selectData = function (toDate, entries, min_count, max_count) {
  const fromDate = dayjs(toDate).add(dayjs().utcOffset(), 'minute')
  const dayEntries = entries.filter(singleEntry => {
    /// ночью не ставим
    const hour = dayjs(singleEntry.dateString).hour()
    const diff = dayjs // ставим только на 2 часа назад
      .duration(dayjs(singleEntry.dateString).diff(fromDate))
      .hours()
    return hour >= 6 && hour < 23 && diff >= -2 && diff <= 0
  })

  const result = []
  if (dayEntries.length > 0) {
    const selectionSize = randomInt(min_count, max_count)
    const slotSize = Math.floor(dayEntries.length / selectionSize)
    for (let index = 0; index < selectionSize; index++) {
      const ind = randomInt(index * slotSize + 1, slotSize)
      result.push(dayEntries[ind])
    }
  }

  const lastPoint = entries[0] // последняя точка графика
  const lastHour = dayjs(lastPoint.dateString).hour()
  if (lastHour >= 6 && lastHour < 23) {
    result.push(lastPoint)
  }
  return result
}

const getNightscoutAllEntries = async function (
  baseUrl,
  token,
  fromDate,
  toDate,
  min_count,
  max_count,
  needPoints
) {
  const url = `${baseUrl}/api/v1/entries.json?find[dateString][$gte]=${fromDate}&find[dateString][$lt]=${toDate}&count=131072${getNightscoutToken(
    token
  )}`
  console.log('glucose entries url', url.gray)

  const response = await axios.get(url, {
    headers: {
      'Content-Type': 'application/json'
    }
  })

  console.log('glucose entries read:', (response.data || []).length.toString())
  const utcOffset = response.data[0].utcOffset
  console.log('UTC Offset:', utcOffset.toString())

  const dataGlucose = response.data
    .filter((value, index, Arr) => index % 3 == 0)
    .filter((value, index, Arr) => value.sgv > 30)
    .map(d => {
      const dateStringLocal = dayjs.utc(d.dateString).utcOffset(utcOffset)
      return {
        id: parseInt(`1${dateStringLocal.format('YYYYMMDDHHmmss')}`),
        sysTime: d.sysTime,
        dateString: dateStringLocal.format(),
        sgv: d.sgv,
        delta: d.delta,
        direction: d.direction
      }
    })

  const dataGlucoseScheduled = dataGlucose.map(d => {
    return {
      valueInMgPerDl: d.sgv,
      extendedProperties: {
        factoryTimestamp: d.sysTime,
        highOutOfRange: d.sgv >= 400 ? 'true' : 'false',
        lowOutOfRange: d.sgv <= 40 ? 'true' : 'false',
        isFirstAfterTimeChange: false,
        CanMerge: 'true'
      },
      recordNumber: d.id,
      timestamp: d.dateString
    }
  })

  let dataGlucoseUnscheduled = []
  if (needPoints) {
    dataGlucoseUnscheduled = selectData(
      toDate,
      dataGlucose,
      min_count,
      max_count
    ).map(d => {
      return {
        valueInMgPerDl: d.sgv,
        extendedProperties: {
          factoryTimestamp: d.sysTime,
          lowOutOfRange: d.sgv <= 40 ? 'true' : 'false',
          highOutOfRange: d.sgv >= 400 ? 'true' : 'false',
          trendArrow: getDirection(d.direction),
          isActionable: true,
          CanMerge: 'true',
          isFirstAfterTimeChange: false
        },
        recordNumber: d.id,
        timestamp: d.dateString
      }
    })
  }

  const url1 = `${baseUrl}/api/v1/treatments.json?find[created_at][$gte]=${fromDate}&find[created_at][$lt]=${toDate}&find[carbs][$gt]=0&count=131072${getNightscoutToken(
    token
  )}`
  console.log('food entries url', url1.gray)

  const response1 = await axios.get(url1, {
    headers: {
      'Content-Type': 'application/json'
    }
  })
  console.log('food entries read:', (response1.data || []).length.toString())
  const dataFood = response1.data.map(d => {
    const created_at_Local = dayjs.utc(d['created_at']).utcOffset(utcOffset)

    return {
      extendedProperties: {
        factoryTimestamp: d['created_at']
      },
      recordNumber: parseInt(`2$created_at_Local.format('YYYYMMDDHHmmss')}`),
      timestamp: created_at_Local.format(),
      gramsCarbs: d.carbs,
      foodType: 'Unknown'
    }
  })

  const url2 = `${baseUrl}/api/v1/treatments.json?find[created_at][$gte]=${fromDate}&find[created_at][$lt]=${toDate}&find[insulin][$gt]=0&count=131072${getNightscoutToken(
    token
  )}`
  console.log('insulin entries url', url2.gray)

  const response2 = await axios.get(url2, {
    headers: {
      'Content-Type': 'application/json'
    }
  })
  console.log('insulin entries read:', (response2.data || []).length.toString())
  const dataInsulin = response2.data.map(d => {
    const created_at_Local = dayjs.utc(d['created_at']).utcOffset(utcOffset)
    const longInsExp = /(Lantus|Toujeo)/i
    const longIns = longInsExp.test(d.insulinInjections || '')

    return {
      extendedProperties: {
        factoryTimestamp: d['created_at']
      },
      recordNumber: parseInt(`4$created_at_Local.format('YYYYMMDDHHmmss')}`),
      timestamp: created_at_Local.format(),
      units: d.insulin,
      insulinType: longIns ? 'LongActing' : 'RapidActing'
    }
  })

  return {
    glucoseEntriesScheduled: dataGlucoseScheduled,
    glucoseEntriesUnscheduled: dataGlucoseUnscheduled,
    foodEntries: dataFood,
    insulinEntries: dataInsulin
  }
}

exports.getNightscoutAllEntries = getNightscoutAllEntries
exports.randomInt = randomInt
