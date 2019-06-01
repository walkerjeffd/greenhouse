process.env['NODE_CONFIG_DIR'] = __dirname + '/../config';

const Influx = require('influx');
const DarkSky = require('darksky-node/lib/darksky-api');
const cron = require('node-cron');

const config = require('config');

const cronConfig = config.get('cron');

const influxConfig = config.get('influx');
const influx = new Influx.InfluxDB({
  ...influxConfig,
  schema: [
    {
      measurement: 'weather',
      tags: ['source'],
      fields: {
        temperature: Influx.FieldType.FLOAT,
        apparent_temperature: Influx.FieldType.FLOAT,
        dew_point: Influx.FieldType.FLOAT,
        humidity: Influx.FieldType.FLOAT,
        wind_speed: Influx.FieldType.FLOAT,
        wind_bearing: Influx.FieldType.FLOAT,
        cloud_cover: Influx.FieldType.FLOAT,
        pressure: Influx.FieldType.FLOAT,
        ozone: Influx.FieldType.FLOAT,
        precip_intensity: Influx.FieldType.FLOAT,
        precip_probability: Influx.FieldType.FLOAT,
        nearest_storm_distance: Influx.FieldType.FLOAT,
        nearest_storm_bearing: Influx.FieldType.FLOAT
      }
    }
  ]
});

const darkskyConfig = config.get('darksky');
const darksky = new DarkSky(darkskyConfig.key);

function getForecast() {
  darksky.forecast(
    darkskyConfig.latitude,
    darkskyConfig.longitude,
    {
      exclude: ['minutely', 'hourly', 'daily', 'alerts', 'flags'],
      units: darkskyConfig.units
    },
    function(err, responseBody) {
      if (err) {
        console.error(err);
        return;
      }
      const forecast = JSON.parse(responseBody);
      const current = forecast.currently;
      const points = [
        {
          measurement: 'weather',
          fields: {
            temperature: current.temperature,
            apparent_temperature: current.apparentTemperature,
            dew_point: current.dewPoint,
            humidity: current.humidity,
            wind_speed: current.windSpeed,
            wind_bearing: current.windBearing,
            cloud_cover: current.cloudCover,
            pressure: current.pressure,
            ozone: current.ozone,
            precip_intensity: current.precipIntensity,
            precip_probability: current.precipProbability,
            nearest_storm_distance: current.nearestStormDistance,
            nearest_storm_bearing: current.nearestStormBearing
          },
          tags: {
            source: 'darksky'
          }
        }
      ];

      influx.writePoints(points)
        .catch(err => {
          console.error('Error writing to InfluxDB', err);
        });
    }
  );
}

if (cronConfig.schedule) {
  cron.schedule(cronConfig.schedule, function() {
    getForecast();
  });
  console.log(`DarkSky data will be written to InfluxDB on cron interval '${cronConfig.schedule}'`);
} else {
  getForecast();
  console.log('DarkSky data is written to InfluxDB');
}
