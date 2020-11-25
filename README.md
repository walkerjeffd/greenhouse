Greenhouse Monitoring System
============================

Jeffrey D Walker, PhD <jeff@walkerenvres.com>  
[Walker Environmental Research LLC](https://walkerenvres.com)

## About

This repo contains the source code and instructions for an ambient monitoring system designed specifically to monitor temperature and humidity levels in my greenhouse. However, it could be adapted to a variety of use cases with different sensors.

## Overview

The system includes the following components:

1. Sensor Node(s) ([Arduino Feather M0 w/ RFM95 LoRA Radio - 900 Mhz](https://www.adafruit.com/product/3178))
2. LoRa Gateway ([The Things Gateway - 915 Mhz Version](https://www.adafruit.com/product/3943))
3. LoRaWAN Network ([The Things Network](https://www.thethingsnetwork.org/))
4. Metrics Collector ([Telegraph](https://docs.influxdata.com/telegraf/v1.12/))
5. Time Series Database ([InfluxDB](https://docs.influxdata.com/influxdb/v1.7/))
6. Dashboard ([Grafana](https://grafana.com/))

## Instructions

### Set Up LoRa Gateway on TTN

For first time set up, follow the [Activation Instructions](https://www.thethingsnetwork.org/docs/gateways/gateway/#activating-the-gateway).

After activation, check that the gateway is online from the [TTN console](https://console.thethingsnetwork.org/gateways/). The first four LEDs should all be solid.

If only the first three LEDs are solid, and the fourth is blinking then the gateway is having trouble connecting to TTN. Try changing the router for the gateway to `ttn-router-eu` using the TTN console.

If only the first LED is solid and the second is blinking, then it is not connecting to the internet. Check the WiFi configuration:

1. Navigate to the IP address of the gateway (see WiFi router admin panel for IP address)
2. Click the refresh button beside the WiFi Access Point input
3. Select the WiFi network
4. Enter WiFi Password
5. Click Save

The gateway should then reset and go through the usual boot up sequence.

**References**

- [Activation Instructions | TTN](https://www.thethingsnetwork.org/docs/gateways/gateway/#activating-the-gateway)
- [FAQ | TTN](https://www.thethingsnetwork.org/docs/gateways/gateway/faq.html)
- [Status LEDs | TTN](https://www.thethingsnetwork.org/docs/gateways/gateway/ledstatus.html)
- [Forum | TTN](https://www.thethingsnetwork.org/forum/c/gateways/the-things-gateway)
- [TheThingsProducts/gateway Repo](https://github.com/TheThingsProducts/gateway)

### Create TTN Application

Add a new application from the [TTN Console](https://console.thethingsnetwork.org/applications). Be sure to the set the handler to the same router used by the gateway (e.g. `ttn-handler-eu`).

Next, add a device by assigning a unique device ID (e.g. `feather-0`) and generating a random device EUI.

### Set Up Sensor Node

Each sensor node consists of an Adafruit Feather M0 w/ LoRa radio and a sensor.

#### Arduino IDE

For the Adafruit Feather M0, add the `Adafruit SAMD Boards` package to the Arduino IDE (see [Setup Instructions](https://learn.adafruit.com/adafruit-feather-m0-radio-with-lora-radio-module/setup))

[Adafruit Feather M0 w/ LoRa Radio Tutorial | Adafruit](https://learn.adafruit.com/adafruit-feather-m0-radio-with-lora-radio-module)

#### SHT10 Sensor

The [SHT-10 Mesh-protected Weather-proof Temperature/Humidity Sensor](https://www.adafruit.com/product/1298) measures temperature and humidity at precisions 0.5 degC and 0.5%.

For the old version of the sensor, connect:

- Red to VCC (3-5VDC)
- Green to Ground
- Blue (Data) to pin 10
- Yellow (Clock) to pin 11
- 10k Resistor between Data and VCC

Install the [SHT1x library](https://github.com/practicalarduino/SHT1x) into the Arduino IDE.

Run the example sketch (`File > Examples > SHT1x > ReadSHT1xValues`) to test the sensor.

**References**

- [SHT-10 Mesh-protected Weather-proof Temperature/Humidity Sensor | Adafruit](https://www.adafruit.com/product/1298)
- [SHT1x library](https://github.com/practicalarduino/SHT1x)

#### LoRa Radio

To use the LoRa radio with an antenna, first add a jumper between pin 6 and io1 (see [Arduino Wiring](https://learn.adafruit.com/the-things-network-for-feather/arduino-wiring)). Then solder a 3" wire to the ANT pad.

Install the `MCCI LoRaWAN LMIC library` in the Arduino IDE (see [Aduino Setup](https://learn.adafruit.com/the-things-network-for-feather/arduino-setup)).

Use the `ttn-otaa-feather-us915-dht22` example sketch to test the LoRa radio and TTN configuration. Comment out most of the `Pin mapping` section other than the part for `ARDUINO_SAMD_FEATHER_M0` (which is not defined even when using Feather M0?).

Copy the Application EUI and Device EUI from the TTN console in little endian (`lsb`) format to the `APPEUI` and `DEVEUI` variables (replace `FILLMEIN`). Copy the App Key in big endian format (`msb`) to the `APPKEY` variable. Upload the sketch and check for data transmission on the TTN console. The payload should be `48656C6C6F2C20776F726C6421`, which is HEX for `Hello, world!`.

**References**

- [Using LoraWAN and the Things Network with Feather | Adafruit](https://learn.adafruit.com/the-things-network-for-feather)

#### Cayenne LPP

The Cayenne Low Power Payload encodes sensor data in a standard payload format, and is supported out of the box by TTN.

Change the payload format for the TTN application from Custom to Cayenne LPP.

Install the `Cayenne LPP` library in the Arduino IDE.

Modify the `ttn-otaa-feather-us915-dht22` example to send fake tempature (22.5 degC) and humidity (34.5%) data.

```cpp
#include <CayenneLPP.h>
CayenneLPP lpp(51);

// ...

void do_send(osjob_t* j){
    // Check if there is not a current TX/RX job running
    if (LMIC.opmode & OP_TXRXPEND) {
        Serial.println(F("OP_TXRXPEND, not sending"));
    } else {
        // Prepare upstream data transmission at the next possible time.
        //LMIC_setTxData2(1, mydata, sizeof(mydata)-1, 0);
        lpp.reset();
        lpp.addTemperature(1, 22.5);
        lpp.addRelativeHumidity(1, 34.5);

        LMIC_setTxData2(1, lpp.getBuffer(), lpp.getSize(), 0);
        Serial.println(F("Packet queued"));
    }
}
```

The raw payload should be `01 67 00 E1 01 68 45`, which translates to (see [Payload Examples](https://developers.mydevices.com/cayenne/docs/lora/#lora-cayenne-low-power-payload-examples)):

```
01     Data Channel = 1
67     Type = Temperature (Resolution = 0.1 degC)
00E1   Hex->Ascii = 225 * (0.1 degC) = 22.5 degC
01     Data Channel = 1
68     Type = Relative Humidity
45     Hex->Ascii = 69 * (0.5 %) = 34.5 %
```

The gateway should automatically convert the payload:

```json
{
  "temperature_1": 22.5,
  "relative_humidity_1": 34.5
}
```

**References**

- [Cayenne LPP API Reference | TTN](https://www.thethingsnetwork.org/docs/devices/arduino/api/cayennelpp.html)
- [Cayenne LPP Docs | Cayenne](https://developers.mydevices.com/cayenne/docs/lora/#lora-cayenne-low-power-payload)

#### Final Sketch

Create a new sketch in Arduino IDE, and copy the code from `./ino/feather-m0-ttn-sht10.ino`, which combines the example sketches for the LoRa radio and SHT10 sensor libraries.

Replace `FILLMEIN` with the App EUI (`lsb`), Device EUI (`lsb`), and App Key (`msb`).

Upload sketch, and check the transmitted payloads on the [TTN console](https://console.thethingsnetwork.org/).

### Create Database (InfluxDB)

After installing InfluxDB ([Installation](https://docs.influxdata.com/influxdb/v1.7/introduction/installation/)), open the CLI.

```sh
influx -precision rfc3339
```

Then create a new database named `greenhouse`.

```sql
CREATE DATABASE greenhouse;
```

Use default retention policy `autogen` which has infinite duration.

```text
> show retention policies
name    duration shardGroupDuration replicaN default
----    -------- ------------------ -------- -------
autogen 0s       168h0m0s           1        true
```

Add continuous queries for converting raw data to 1-minute intervals in measurement `data_1m`, and aggregating min/mean/max values to daily intervals in measurement `data_1day`.

```sql
CREATE CONTINUOUS QUERY cq_data_1m ON greenhouse BEGIN SELECT mean(payload_fields_temperature_1) AS temp_degC, mean(payload_fields_relative_humidity_1) AS humidity_pct, mean(metadata_gateways_0_rssi) AS rssi, mean(metadata_gateways_0_snr) AS snr INTO greenhouse.autogen.data_1m FROM greenhouse.autogen.mqtt_consumer GROUP BY time(1m), * END

CREATE CONTINUOUS QUERY cq_data_1d ON greenhouse BEGIN SELECT min(temp_degC) AS temp_degC_min, mean(temp_degC) AS temp_degC_mean, max(temp_degC) AS temp_degC_max, min(humidity_pct) AS humidity_pct_min, mean(humidity_pct) AS humidity_pct_mean, max(humidity_pct) AS humidity_pct_max INTO greenhouse.autogen.data_1d FROM greenhouse.autogen.data_1m GROUP BY time(1d), * TZ('America/New_York') END
```

If CQ is added after data has been collected, then backfill using this query:

```
SELECT mean(payload_fields_temperature_1) AS temp_degC, mean(payload_fields_relative_humidity_1) AS humidity_pct, mean(metadata_gateways_0_rssi) AS rssi, mean(metadata_gateways_0_snr) AS snr INTO greenhouse.autogen.data_1m FROM greenhouse.autogen.mqtt_consumer GROUP BY time(1m), *

SELECT min(temp_degC) AS temp_degC_min, mean(temp_degC) AS temp_degC_mean, max(temp_degC) AS temp_degC_max, min(humidity_pct) AS humidity_pct_min, mean(humidity_pct) AS humidity_pct_mean, max(humidity_pct) AS humidity_pct_max INTO greenhouse.autogen.data_1d FROM greenhouse.autogen.data_1m WHERE time < '2020-06-08T04:00:00Z' GROUP BY time(1d), * TZ('America/New_York')
```

### Data Streaming (Telegraf)

Telegraf is used to stream data from TTN to the influxdb over MQTT protocol.

#### Configure Telegraf

Install telegraf using apt repository ([Installation Instructions](https://docs.influxdata.com/telegraf/v1.13/introduction/installation/)).

Use `service` command to control telegraf:

```sh
sudo service telegraf start/stop/status
```

Telegraf can be configured with multiple configuration files (see [Config Best Practices](https://github.com/influxdata/telegraf/issues/6334#issuecomment-526425287)).

Default configuration files in `./telegraf` were generated using the `config` command (see [Configuration](https://docs.influxdata.com/telegraf/v1.13/administration/configuration/)).

```sh
telegraf --input-filter mqtt_consumer --output-filter influxdb config
```

Copy the configuration files to the server:

```
./telegraf/telegraf.conf -> /etc/telegraf/telegraf.conf
./telegraf/inputs.mqtt_consumer.conf -> /etc/telegraf/telegraf.d/inputs.mqtt_consumer.conf
./telegraf/outputs.influxdb.conf -> /etc/telegraf/telegraf.d/outputs.influxdb.conf
```

These configuration files use environmental variables, which must be defined in `/etc/default/telegraf`:

```ini
INFLUX_DB="<DATABASE NAME (greenhouse)>"
MQTT_HANDLER="<TNN HANDLER (eu.thethings.network)>"
MQTT_APPLICATION_ID="<APPLICATION ID (my-greenhouse)>"
MQTT_ACCESS_KEY="<ACCESS KEY (ttn-account-v2.XXXXX)>"
```

Use the TTN console to generate an access key which should have the form: `ttn-account-v2.<RANDOM CHARACTERS>`.

Use the [mosquitto](https://mosquitto.org/) CLI to test the MQTT parameters.

```sh
mosquitto_sub -h ${MQTT_HANDLER} -t '+/devices/+/up' -u ${MQTT_APPLICATION_ID} -P ${MQTT_ACCESS_KEY} -v
```

If all looks good, start telegraf:

```sh
sudo service telegraf start
sudo service telegraf status
```

**References**

- [Telegraf Configuration](https://docs.influxdata.com/telegraf/v1.13/administration/configuration/)
- [MQTT Data API Quick Start | TTN](https://www.thethingsnetwork.org/docs/applications/mqtt/quick-start.html)

#### Check Data

Telegraf will save results

```
topic=${APPLICATION ID}/devices/${DEVICE ID}/up
payload_fields_${DATA TYPE}_${DATA CHANNEL}
```

To check the data in influxdb:

```
> use <INFLUX_DB>

> show measurements
name: measurements
name
----
mqtt_consumer

> show series
key
---
mqtt_consumer,host=trout,topic=walkerenvres-greenhouse/devices/feather-0/up

> show field keys from mqtt_consumer
name: mqtt_consumer
fieldKey                           fieldType
--------                           ---------
counter                            float
metadata_airtime                   float
metadata_frequency                 float
metadata_gateways_0_altitude       float
metadata_gateways_0_channel        float
metadata_gateways_0_latitude       float
metadata_gateways_0_longitude      float
metadata_gateways_0_rf_chain       float
metadata_gateways_0_rssi           float
metadata_gateways_0_snr            float
metadata_gateways_0_timestamp      float
payload_fields_relative_humidity_1 float
payload_fields_temperature_1       float
port                               float

> show tag keys from mqtt_consumer
name: mqtt_consumer
tagKey
------
host
topic

> select time, counter, payload_fields_relative_humidity_1, payload_fields_temperature_1 from mqtt_consumer order by time desc limit 10
name: mqtt_consumer
time                           counter payload_fields_relative_humidity_1 payload_fields_temperature_1
----                           ------- ---------------------------------- ----------------------------
2020-06-08T18:31:03.03027641Z  1393    29                                 28.4
2020-06-08T18:29:59.943674131Z 1392    30.5                               28.4
2020-06-08T18:28:56.870925368Z 1391    30                                 28.4
2020-06-08T18:27:53.687764314Z 1390    30                                 28.4
2020-06-08T18:26:50.618294112Z 1389    30.5                               28.3
2020-06-08T18:25:47.438324225Z 1388    30.5                               28.3
2020-06-08T18:24:44.363127269Z 1387    28.5                               28.2
2020-06-08T18:23:41.281444938Z 1386    29                                 28.2
2020-06-08T18:22:38.107200301Z 1385    30                                 28.1
2020-06-08T18:21:35.035556816Z 1384    30.5                               28
```

**References**

- [Data Exploration | InfluxDB](https://docs.influxdata.com/influxdb/v1.7/query_language/data_exploration/)
- [Schema Exploration | InfluxDB](https://docs.influxdata.com/influxdb/v1.7/query_language/schema_exploration/)


### Create Dashboard (Grafana)

TODO
