const axios = require('axios');



// base URL (park sensors data)
const PARKSENSORS_BASE_URL = 'https://element-iot.com/api/v1/tags/stadt-kiel-parksensorik-kiellinie';
// auth key (park sensors data)
const PARKSENSORS_AUTH_KEY = '645a23ee6da141b6865fa68101c34ab7';
// interval for querying park sensor states [seconds]
const PARKSENSORS_QUERY_INTERVAL = 60;
// states of park sensors (specified by https://github.com/smart-data-models/dataModel.Parking/blob/master/ParkingSpot/doc/spec.md)
const PARKSENSOR_STATES = { 0: 'free',
    1: 'occupied' };

// NGSI v2 context broker URL
const BROKER_V2_URL = 'http://orion-v2:1026';
// NGSI-LD context broker URL
const BROKER_LD_URL = 'http://orion-ld:1026';

// context brokers
const BROKERS = { v2: [BROKER_V2_URL],
    ldv1: [BROKER_LD_URL] };



// query park sensors states
function readParksensors() {
    let path = `/devices?last_readings=1&limit=100&auth=${PARKSENSORS_AUTH_KEY}`;
    return executeRestRequest('GET', PARKSENSORS_BASE_URL + path, {'Accept': 'application/json'}, null);
}

// transform a read park sensor to a NGSI v2 compliant object
function transformParksensor_NGSI_v2(sensor) {
    if (sensor) {
        let transformedSensor = {};

        transformedSensor['id'] = 'ParkingSpot:' + sensor.slug;
        transformedSensor['name'] = {
            "type": 'Text',
            "value": sensor.name
        };
        transformedSensor['type'] = 'ParkingSpot';
        transformedSensor['category'] = {
            "type": 'Text',
            "value": 'onstreet'
        };
        //TODO: add 'refParkingSite' attribute (mandatory)
        transformedSensor['location'] = {
            "type": 'geo:json',
            "value": {
                "type": sensor.location.type,
                "coordinates": [sensor.location.coordinates[0], sensor.location.coordinates[1]]
            }
        };
        transformedSensor['status'] = {
            "type": 'Text',
            "value": PARKSENSOR_STATES[sensor.last_readings[0].data.map_state] ?
                PARKSENSOR_STATES[sensor.last_readings[0].data.map_state] : 'undefined',
            "metadata": {
                "timestamp": {
                    "type": 'DateTime',
                    "value": new Date(sensor.last_readings[0].inserted_at).toISOString()
                }
            }
        };

        return transformedSensor;
    } else {
        return null;
    }
}

// transform a read park sensor to a NGSI-LD compliant object
function transformParksensor_NGSI_LDv1(sensor) {
    if (sensor) {
        let transformedSensor = {};

        transformedSensor['id'] = 'urn:ngsi-ld:ParkingSpot:' + sensor.slug;
        transformedSensor['name'] = {
            "type": 'Property',
            "value": sensor.name
        };
        transformedSensor['type'] = 'ParkingSpot';
        transformedSensor['category'] = {
            "type": 'Property',
            "value": 'onstreet'
        };
        //TODO: add 'refParkingSite' attribute (mandatory)
        transformedSensor['location'] = {
            "type": 'GeoProperty',
            "value": {
                "type": sensor.location.type,
                "coordinates": [sensor.location.coordinates[0], sensor.location.coordinates[1]]
            }
        };
        transformedSensor['status'] = {
            "type": 'Property',
            "value": PARKSENSOR_STATES[sensor.last_readings[0].data.map_state] ?
                PARKSENSOR_STATES[sensor.last_readings[0].data.map_state] : 'undefined',
            "observedAt": new Date(sensor.last_readings[0].inserted_at).toISOString()
        };
        transformedSensor['@context'] = [
            "https://schema.lab.fiware.org/ld/context",
            "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"
        ];

        return transformedSensor;
    } else {
        return null;
    }
}

function getExistingParksensorIds_CB_NGSI_v2(baseUrl) {
    let path = '/v2/entities?type=ParkingSpot&attrs=id&options=keyValues';
    return executeRestRequest('GET', baseUrl + path,
        {'Accept': 'application/json'}, null);
}

function getExistingParksensorIds_CB_NGSI_LDv1(baseUrl) {
    // BUG?: trying to list all data entities limited to id attribute (attrs=id) returns an empty array, when providing another attribute (despite of 'type', e.g. attrs=id,name) a filled array is returned
    let path = '/ngsi-ld/v1/entities?type=ParkingSpot&attrs=id,name&options=keyValues';
    return executeRestRequest('GET', baseUrl + path,
        {'Accept': 'application/ld+json',
            'Link': '<https://schema.lab.fiware.org/ld/context>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
        }, null);
}

function postParksensors_CB_NGSI_v2(baseUrl, parkSensors) {
    let path = '/v2/op/update';
    return executeRestRequest('POST', baseUrl + path, {'Content-Type': 'application/json'},
        JSON.stringify({'actionType': 'append_strict', 'entities': parkSensors}));
}

function postParksensors_CB_NGSI_LDv1(baseUrl, parkSensors) {
    let path = '/ngsi-ld/v1/entities';
    // post entities individually as batch operations are not implemented yet 
    // (status 12.09.2019, supposedly finished by Christmas this year)
    return Promise.all(parkSensors.map(sensor => {
        return executeRestRequest('POST', baseUrl + path, {'Content-Type': 'application/ld+json'},
            JSON.stringify(sensor));
    }));
}

function patchParksensors_CB_NGSI_v2(baseUrl, parkSensors) {
    return Promise.all(parkSensors.map(sensor => {
        if (sensor && sensor.id && sensor.status && sensor.status.metadata && sensor.status.metadata.timestamp) {
            let path = `/v2/entities/${sensor.id}/attrs`;
            return executeRestRequest('PATCH', baseUrl + path, {'Content-Type': 'application/json'},
                JSON.stringify({
                    'status': {
                        'type': 'Text',
                        'value': sensor.status.value,
                        'metadata': {
                            'timestamp': {
                                'type': 'DateTime',
                                'value': sensor.status.metadata.timestamp.value
                            }
                        }
                    }
                }));
        }
    }));
}

function patchParksensors_CB_NGSI_LDv1(baseUrl, parkSensors) {
    return Promise.all(parkSensors.map(sensor => {
        if (sensor && sensor.id && sensor.status) {
            let path = `/ngsi-ld/v1/entities/${sensor.id}/attrs`;
            return executeRestRequest('PATCH', baseUrl + path, {'Content-Type': 'application/ld+json'},
                JSON.stringify({
                    '@context': 'https://schema.lab.fiware.org/ld/context',
                    'status': {
                        'type': 'Property',
                        'value': sensor.status.value,
                        'observedAt': sensor.status.observedAt
                    }
                }));
        }
    }));
}

// import park sensor data into NGSI v2 broker
let importParksensorsInto_CB_NGSI_v2 = async function(parkSensors) {
    let transformedParksensors = [];
    parkSensors.forEach(sensor => {
        let transformedSensor = transformParksensor_NGSI_v2(sensor);
        if (transformedSensor) {
            transformedParksensors.push(transformedSensor);
        }
    });

    for (const brokerUrl of BROKERS.v2) {
        // IDs of park sensors that already exist in NGSI v2 broker
        const existingIds = [];
        // park sensors that already exist in NGSI v2 broker and need to be updated by new sensor data
        const sensorsToPatch = [];
        // park sensors that do not exist in NGSI v2 broker and need to be posted
        const sensorsToPost = [];
        // query existing park sensors in NGSI v2 broker
        const response = await getExistingParksensorIds_CB_NGSI_v2(brokerUrl);

        //console.log(typeof response);
        //console.log(JSON.stringify(response));

        if (response && response.data && Array.isArray(response.data)) {
            response.data.forEach(sensor => {
                existingIds.push(sensor.id);
            });
            transformedParksensors.forEach(tSensor => {
                // transformed sensor already exists in NGSI v2 broker
                if (existingIds.includes(tSensor.id)) {
                    sensorsToPatch.push(tSensor);
                } else {
                    sensorsToPost.push(tSensor);
                }
            });

            if (sensorsToPatch.length) {
                console.info('importParksensorsInto_CB_NGSI_v2 - INFO: UPDATING EXISTING park sensors in NGSI v2 broker =>');
                console.info(JSON.stringify(sensorsToPatch));
                // update existing park sensors objects in context broker
                patchParksensors_CB_NGSI_v2(brokerUrl, sensorsToPatch);
            }
            if (sensorsToPost.length) {
                console.info('importParksensorsInto_CB_NGSI_v2 - INFO: ADDING NEW park sensors to NGSI v2 broker =>');
                console.info(JSON.stringify(sensorsToPost));
                // add new park sensors objects to context broker
                postParksensors_CB_NGSI_v2(brokerUrl, sensorsToPost);
            }
        } else {
            console.error('importParksensorsInto_CB_NGSI_v2 - ERROR: could not query existing park sensors in NGSI v2 broker');
        }
    };
}

// import park sensor data into NGSI-LD v1 broker
let importParksensorsInto_CB_NGSI_LDv1 = async function(parkSensors) {
    let transformedParksensors = [];
    parkSensors.forEach(sensor => {
        let transformedSensor = transformParksensor_NGSI_LDv1(sensor);
        if (transformedSensor) {
            transformedParksensors.push(transformedSensor);
        }
    });

    for (const brokerUrl of BROKERS.ldv1) {
        // IDs of park sensors that already exist in NGSI-LD broker
        const existingIds = [];
        // park sensors that already exist in NGSI-LD broker and need to be updated by new sensor data
        const sensorsToPatch = [];
        // park sensors that do not exist in NGSI-LD broker and need to be posted
        const sensorsToPost = [];
        // query existing park sensors in NGSI-LD broker
        const response = await getExistingParksensorIds_CB_NGSI_LDv1(brokerUrl);

        //console.log(typeof response);
        //console.log(JSON.stringify(response));

        if (response && response.data && Array.isArray(response.data)) {
            response.data.forEach(sensor => {
                existingIds.push(sensor.id);
            });
            transformedParksensors.forEach(tSensor => {
                // transformed sensor already exists in NGSI-LD broker
                if (existingIds.includes(tSensor.id)) {
                    sensorsToPatch.push(tSensor);
                } else {
                    sensorsToPost.push(tSensor);
                }
            });

            if (sensorsToPatch.length) {
                console.info('importParksensorsInto_CB_NGSI_LDv1 - INFO: UPDATING EXISTING park sensors in NGSI-LD broker =>');
                console.info(JSON.stringify(sensorsToPatch));
                // update existing park sensors objects in context broker
                patchParksensors_CB_NGSI_LDv1(brokerUrl, sensorsToPatch);
            }
            if (sensorsToPost.length) {
                console.info('importParksensorsInto_CB_NGSI_LDv1 - INFO: ADDING NEW park sensors to NGSI-LD broker =>');
                console.info(JSON.stringify(sensorsToPost));
                // add new park sensors objects to context broker
                postParksensors_CB_NGSI_LDv1(brokerUrl, sensorsToPost);
            }
        } else {
            console.error('importParksensorsInto_CB_NGSI_LDv1 - ERROR: could not query existing park sensors in NGSI-LD broker');
        }
    };
}

let importParksensorsIntoContextBrokers = async function(parkSensors) {
    if (!Array.isArray(parkSensors)) {
        console.error('importParksensorsIntoContextBrokers - ERROR: \'parkSensors\' not set or not of type Array');
        return;
    }

    // we have an array of NGSI v2 brokers defined -> import park sensor data into brokers
    if (BROKERS.v2.length) {
        importParksensorsInto_CB_NGSI_v2(parkSensors);
    }
    // we have an array of NGSI-LD brokers defined -> import park sensor data into brokers
    if (BROKERS.ldv1.length) {
        importParksensorsInto_CB_NGSI_LDv1(parkSensors);
    }
}

async function start() {
    try {
        const pSensorsResponse = await readParksensors();

        if (pSensorsResponse && pSensorsResponse.data && Array.isArray(pSensorsResponse.data.body)) {
            // import read park sensors into context brokers
            importParksensorsIntoContextBrokers(pSensorsResponse.data.body);
        } else {
            console.warn('start - WARN: no park sensors data found for transforming');
        }
    } catch(err) {
        console.error(err);
    }
}

start();
// keep querying / importing park sensor states every PARKSENSORS_QUERY_INTERVAL seconds
setInterval(start, PARKSENSORS_QUERY_INTERVAL * 1000);


/**
 * Executes a RESTful HTTP request
 * @param {*} method
 * @param {*} url
 * @param {*} headers
 * @param {*} body
 */
function executeRestRequest(method, url, headers, body) {
    if (!axios) {
        console.error('executeRestRequest - ERROR: axios library not found');
    }
    if (!method) {
        console.error('executeRestRequest - ERROR: no HTTP method given');
    }
    if (!url) {
        console.error('executeRestRequest - ERROR: no request URL given');
    }

    let requestConfig = {
        method: method,
        url: url,
        headers: headers
    };
    if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
        requestConfig.data = body;
    }

    console.info(`\n==> trying to ${method}: '${url}'`);
    console.info(`=> headers: ${JSON.stringify(headers)}`);
    console.info(`=> body: ${JSON.stringify(body)}`);

    return new Promise((resolve, reject) => {
        axios.request(requestConfig)
            .then(response => {
                console.info('\n==> RESPONSE');
                if (response.error) {
                    console.error(response);
                } else {
                    console.info(`=> status code: ${response.status}`);
                    console.info(`=> status message: '${response.statusText}'`);
                    console.info(`=> headers: ${JSON.stringify(response.headers)}`);
                    console.info(`=> body:\n${JSON.stringify(response.data)}`);
                }
                resolve(response);
            })
            .catch(error => {
                console.error(error);
                reject(error);
            });
    });
}