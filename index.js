/*
* Copyright 2017 Joachim Bakke
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


const Bacon = require('baconjs');
const debug = require('debug')('signalk-polar');
const util = require('util');
const utilSK = require('@signalk/nmea0183-utilities');
const express = require("express");
const _ = require('lodash');
const sqlite3 = require('sqlite3');
var db,json;
var pushInterval;

var vmg, rot, stw, awa, twa, aws, tws, eng, sog, cog, tack;
var engineRunning = true;
var engineSKPath = "";
var rateOfTurnLimit
var twsInterval = 0.1 ;//Wind speed +-0.1 m/s
var twaInterval = 0.0174533 ;//Wind angle +-1 degree
var stableCourse = false;

var vmgTimeSeconds = rotTimeSeconds = stwTimeSeconds = twaTimeSeconds = twsTimeSeconds = vmgTimeSeconds = awaTimeSeconds = awsTimeSeconds = engTimeSeconds = cogTimeSeconds = sogTimeSeconds = 0
var lastStored = 1
var secondsSincePush

const items = [
  "performance.velocityMadeGood", // if empty, populate from this plugin
  "navigation.rateOfTurn", // if above threshold, vessel is turning and no data is stored
  "navigation.speedThroughWater",
  "environment.wind.angleApparent",
  "environment.wind.speedApparent",
  "navigation.courseOverGroundTrue",
  "navigation.speedOverGround"
];
const maxInterval = 2 ;//max interval between updates for all items to avoid updating on stale data

module.exports = function(app, options) {
  'use strict';
  var client;
  var selfContext = "vessels." + app.selfId;

  var unsubscribes = [];
  var shouldStore = function(path) { return true; };

  function handleDelta(delta, options) {
    if(delta.updates && delta.context === selfContext) {
      delta.updates.forEach(update => {
        if(update.values && typeof update.source != 'undefined' && (update.source.talker != 'signalk-polar')) {

          var points = update.values.reduce((acc, pathValue, options) => {
console.log(update.timestamp + " " + pathValue.path + " " + pathValue.value);
            if(typeof pathValue.value === 'number') {//propulsion.*.state is not number!
              var storeIt = shouldStore(pathValue.path);



              if ( storeIt) {

                if (pathValue.path == "navigation.rateOfTurn"){
                  var rotTime = new Date(update.timestamp);
                  rotTimeSeconds = rotTime.getTime() / 1000; //need to convert to seconds for comparison
                  rot = pathValue.value;
                }
                if (pathValue.path == "navigation.speedThroughWater"){
                  var stwTime = new Date(update.timestamp);
                  stwTimeSeconds = stwTime.getTime() / 1000;
                  stw = pathValue.value;
                }
                if (pathValue.path == "environment.wind.angleApparent"){
                  var awaTime = new Date(update.timestamp);
                  awaTimeSeconds = awaTime.getTime() / 1000;
                  awa = pathValue.value;
                }
                if (pathValue.path == "environment.wind.angleTrueGround"){
                  twa = pathValue.value;
                  var twaTime = new Date(update.timestamp);
                  twaTimeSeconds = twaTime.getTime() / 1000
                }
                if (pathValue.path == "environment.wind.speedApparent"){
                  var awsTime = new Date(update.timestamp);
                  awsTimeSeconds = awsTime.getTime() / 1000;
                  aws = pathValue.value;
                }
                if (pathValue.path == "environment.wind.speedTrue"){
                  tws = pathValue.value;
                  var twsTime = new Date(update.timestamp);
                  twsTimeSeconds = twsTime.getTime() / 1000
                }
                if (pathValue.path == "navigation.courseOverGroundTrue"){
                  var cogTime = new Date(update.timestamp);
                  cogTimeSeconds = cogTime.getTime() / 1000;
                  cog = pathValue.value;
                }
                if (pathValue.path == "navigation.speedOverGround"){
                  var sogTime = new Date(update.timestamp);
                  sogTimeSeconds = sogTime.getTime() / 1000;
                  sog = pathValue.value;
                }
                if (pathValue.path == "performance.velocityMadeGood"){
                  vmg = pathValue.value;
                  var vmgTime = new Date(update.timestamp);
                  vmgTimeSeconds = vmgTime.getTime() / 1000
                  var engTime;
                }


                //debug("times: " /*+ rotTimeSeconds + " "*/ + stwTimeSeconds + " " + awaTimeSeconds + " " + engTimeSeconds)
                //debug("rot: " +rot + " stw: " + stw + " awa: " + awa+ " eng: " + eng)
                var timeMax = Math.max(/*rotTimeSeconds,*/ stwTimeSeconds, awaTimeSeconds, awsTimeSeconds, cogTimeSeconds);
                var timeMin = Math.min(/*rotTimeSeconds,*/ stwTimeSeconds, awaTimeSeconds, awsTimeSeconds, cogTimeSeconds);
                var timediff = timeMax - timeMin; //check that values are fairly concurrent
                //debug("time diff " + timediff)


                if ((engineSKPath.indexOf(".state") > -1) && (eng != '[object Object]' && eng != 'started')){
                  engineRunning = true;
                } else if ((engineSKPath.indexOf(".revolutions") > -1 ) && (eng <= 1)){ //RPM = 0
                  engineRunning = true;
                } else {
                  engineRunning = false;
                }
                //debug("engine running? " + engineRunning)
                if (Math.abs(rot*3437) < rateOfTurnLimit){stableCourse = true;
                }
                else stableCourse = false;
                //debug("stable course? " + stableCourse +" "+ Math.abs(rot*3437) + " deg/min compared to " + rateOfTurnLimit)

                const MPS_PER_KNOT = 1852 / 3600; // meters per second in 1 knot
                if (timediff < maxInterval && !engineRunning  && stableCourse && lastStored < timeMax - 1 && 
	            2*MPS_PER_KNOT <= navigationSpeedThroughWater && 
		    ((environmentWindSpeedApparent % 5) <= 0.2 || (environmentWindSpeedApparent % 5) >= 4.8))
	        {
                  debug("sailing")
                  if (timeMax - twaTimeSeconds > 1){
                    twa = getTrueWindAngle(stw, tws, aws, awa);
                  }
                  if(timeMax - twsTimeSeconds > 1){
                    tws = getTrueWindSpeed(stw, aws, awa);
                  }
                  if (timeMax - vmgTimeSeconds > 1){
                    vmg = getVelocityMadeGood(stw, twa);
                  }

                  /*if (secondsSincePush < timeMax - 1){
                    pushDelta(app,  {"key": "environment.wind.speedTrue", "value": tws});
                    pushDelta(app,  {"key": "environment.wind.angleTrueWater", "value": twa});
                    pushDelta(app,  {"key": "performance.velocityMadeGood", "value": vmg});
                    secondsSincePush = timeMax;
                  }*/
                  //tack is implicit in wind angle, no need to check (or store)
                  //but check if rot between limits -5deg/min < rot < 5deg/min

                  //debug(`SELECT * FROM polar Where environmentWindSpeedTrue <= `+ tws + ` AND environmentWindAngleTrueGround = ` + twa + ` AND navigationSpeedThroughWater >= `+ stw )

                  db.get(`SELECT * FROM polar
                    Where environmentWindSpeedApparent = ?
                    AND environmentWindAngleApparent = ?
                    AND navigationSpeedThroughWater >= ?` ,aws, awa, stw, (err,row) => {

                  if(err){
                    debug(err)
                    return debug(err)
		    }

                  debug("response type: " + typeof (row))
                  if(typeof row !== 'object' || row.navigationSpeedThroughWater === 'undefined') {
                    //no better performance found from history
                    debug("time to update")
                    if (awa < 0) {
                      tack = "port";
                    }
                    else {
                      tack = "starboard";
                    }

                    var timeMaxIso = new Date(timeMax*1000).toISOString()

                    db.get(`INSERT INTO polar
                      (timestamp, environmentWindSpeedApparent, environmentWindSpeedTrue, environmentWindAngleApparent, environmentWindAngleTrueGround, navigationSpeedThroughWater, performanceVelocityMadeGood, tack)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ? )`, timeMaxIso, aws, tws, awa, twa, stw, vmg, tack, function(err,row){
                    if(err) {
                          debug(err);
                          app.setProviderError(err)
                        }

                    else {

                      debug("New entry written to db")
                      app.setProviderStatus("writing to db")
                    }
                  });
                } else {
                  debug('Data received from db, stw: ' + row.navigationSpeedThroughWater)
                }
                return
              });
            }
          }
        }
        return acc;
      }, []);
    }
  });
}}


  return {
    id: "signalk-polar",
    name: "Polar storage and retrieval",
    description: "Signal K server plugin that stores and retrieves polar data from sqlite3 database",

    schema: {
      type: "object",
      title: "A Signal K (node) plugin to maintain polar diagrams in a sqlite3 database",
      description: "",
      required: [
        "engine", "sqliteFile"
      ],

      properties: {
        engine: {
          type: "string",
          title: "How is engine status monitored - stores to polar only when engine off",
          default: "AlwaysOff",
          "enum": ["AlwaysOff", "propulsion.*.revolutions", "propulsion.*.state"],
          enumNames: ["assume engine always off", "propulsion.*.revolutions > 0", "propulsion.*.state is not \'started\'"]
        },
        additional_info: {
          type: "string",
          title: "replace * in \'propulsion.*.revolutions\' or \'propulsion.*.state\' with [ ] or type GPIO# [ ]"
        },
        sqliteFile: {
          type: "string",
          title: "File for storing sqlite3 data, relative path to server",
          default: "./polarDatabase.db"
        },
        rateOfTurnLimit: {
          type: "number",
          title: "Store in database if rate of turn is less than [ ] deg/min (inertia gives false reading while turning vessel)",
          default: 5
        },
        entered: {
          type: "array",
          title: "User input polars",
          items: {
            title: " ",
            type: "object",
            properties: {
              polarName: {
                type: "string",
                title: "Name of polar ('design', 'lastYear' etc)",
                default: "Design"
              },
              angleUnit: {
                type: "string",
                title: "Unit for wind angle",
                default: "deg",
                "enum": ["rad", "deg"],
                enumNames: ["Radians", "Degrees"]
              },
              windSpeedUnit: {
                type: "string",
                title: "Unit for wind speed",
                default: "ms",
                "enum": ["knots", "ms", "kph", "mph"],
                enumNames: ["Knots", "m/s", "km/h", "mph"]
              },
              boatSpeedUnit: {
                type: "string",
                title: "Unit for boat speed",
                default: "kn",
                "enum": ["knots", "ms", "kph", "mph"],
                enumNames: ["Knots", "m/s", "km/h", "mph"]
              },
              polarArray: {
                type: "array",
                title: "Polar values",
                items: {
                  title: "Enter your values",
                  type: "object",
                  properties: {
                    "windSpeed": {
                      title: "wind speed",
                      type: "number",
                    },
                    "windAngle": {
                      title: "True wind angle",
                      type: "number"
                    },
                    "boatSpeed": {
                      title: "Boat speed",
                      type: "number"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    start: function(options) {

      db = new sqlite3.Database(options.sqliteFile);

      db.run(`CREATE TABLE IF NOT EXISTS polar (
        timestamp TEXT,
        environmentWindSpeedApparent DOUBLE DEFAULT NULL,
        environmentWindSpeedTrue DOUBLE DEFAULT NULL,
        environmentWindAngleApparent DOUBLE DEFAULT NULL,
        environmentWindAngleTrueGround DOUBLE DEFAULT NULL,
        navigationSpeedThroughWater DOUBLE DEFAULT NULL,
        performanceVelocityMadeGood DOUBLE DEFAULT NULL,
        tack TEXT,
        navigationRateOfTurn DOUBLE DEFAULT NULL)`);

        if(options.entered && options.entered.length > 0 ){
          options.entered.forEach(table => {
            var tableName = table.polarName

            db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (
              environmentWindSpeedTrue DOUBLE DEFAULT NULL,
              environmentWindAngleTrueGround DOUBLE DEFAULT NULL,
              navigationSpeedThroughWater DOUBLE DEFAULT NULL,
              performanceVelocityMadeGood DOUBLE DEFAULT NULL)`, function(err, row){
                if(err){
                  debug("add self entered tables error: " + err.message);
                } else {

                  var createTestData = function() {

                    var stmt = db.prepare(`insert into ${tableName} values (?, ?, ?, ?)`);
                    table.polarArray.forEach(entry => {
                      var windSpeedSI = utilSK.transform(entry.windSpeed, table.windSpeedUnit, 'ms');
                      var windAngleSI = utilSK.transform(entry.windAngle, table.angleUnit, 'rad');
                      var boatSpeedSI = utilSK.transform(entry.boatSpeed, table.boatSpeedUnit, 'ms');
                      stmt.run(windSpeedSI, windAngleSI, boatSpeedSI, getVelocityMadeGood(boatSpeedSI, windAngleSI))
                    })
                    stmt.finalize();
                  };
                  createTestData(row)
                }
              })
            })
          } else {
            db.all(`SELECT * FROM sqlite_master WHERE type='table'`, function(err, rows){
              if(err){
                debug("find unused tables error: " + err.message);
              } else {
                rows.forEach(row => {
                  if(row.name != 'polar'){
                    debug("table found to remove: " + row.name);
                    db.run(`DROP TABLE ${row.name}`)
                  }

                })
              }
            })
            // delete all user entered polars
          }
          pushInterval = setInterval(function() {
            //debug("tws: " + tws + " abs twa: " + Math.abs(twa) + " stw: " + stw)
            getTarget(app, tws, twsInterval, Math.abs(twa), twaInterval, stw);
            //debug("sent to setInterval:" +  tws + " : " + twsInterval + " : " + Math.abs(twa) + " : " + twaInterval);
          }, 1000);

          debug("started");




          var obj = {};
          if (options.engine == 'propulsion.*.revolutions'){
            items.push(options.engine.replace(/\*/g, options.additional_info));
            engineSKPath = options.engine.replace(/\*/g, options.additional_info);
          }
          else if (options.engine == 'propulsion.*.state'){
            items.push(options.engine.replace(/\*/g, options.additional_info));
            engineSKPath = options.engine.replace(/\*/g, options.additional_info);
          }
          else if (options.engine == "AlwaysOff"){
            engineSKPath = "AlwaysOff";
          }
          rateOfTurnLimit = options.rateOfTurnLimit
          //debug("listening for " + util.inspect(items));
          //debug("engineSKPath: " + engineSKPath);
          items.forEach(element => {
            obj[element] = true;
          });

          shouldStore = function(path) {
            return typeof obj[path] != 'undefined';
          };

          app.signalk.on('delta', handleDelta);


        },
        registerWithRouter: function(router) {
          router.get('/polarTable', (req, res) => {
            res.contentType('application/json');
            //debug(util.inspect(req.query)); // http://localhost:3000/plugins/signalk-polar/polarTable/?windspeed=4&interval=0.1
            var windspeed = parseFloat(req.query.windspeed);
            var interval = parseFloat(req.query.interval);
            var table = req.query.table?req.query.table:"polar" //"polar" is default db

            db.all(`SELECT environmentWindAngleApparent AS angle,
              MAX(navigationSpeedThroughWater) AS speed
              FROM ${table}
              WHERE environmentWindSpeedApparent < ?
              AND  environmentWindSpeedApparent > ?
              GROUP BY environmentWindAngleApparent
              ORDER BY ABS(environmentWindAngleApparent)`, windspeed + interval, windspeed - interval, function(err, rows){

            // error will be an Error if one occurred during the query
            if(err){
              debug("registerWithRouter error: " + err.message);
            }
            res.send(JSON.stringify(rows))
          }
        )
      })
      router.get('/listPolarTables', (req, res) => { //list all polar tables (both sqlite and user entered)
        res.contentType('application/json');

        db.serialize(function () {
          db.all("select name from sqlite_master where type='table'", function (err, tables) {
            // error will be an Error if one occurred during the query
            if(err){
              debug("registerWithRouter error: " + err.message);
            }
            res.send(JSON.stringify(tables))
          });
        });

      })

      router.get('/listWindSpeeds', (req, res) => { //list all wind speeds for a polar diagram
        res.contentType('application/json');
        var table = req.query.table

        db.serialize(function () {
          db.all(`SELECT DISTINCT round(environmentWindSpeedApparent,1) as windSpeed FROM ${table} ORDER BY windSpeed ASC`, function (err, tables) {
            // error will be an Error if one occurred during the query
            if(err){
              debug("registerWithRouter error: " + err.message);
            }
            res.send(JSON.stringify(tables))
          });
        });

      })

    },


    stop: function() {
      debug("Stopping")
      unsubscribes.forEach(f => f());
      items.length = items.length - 1;
      engineSKPath = "";

      //db.close();


      clearInterval(pushInterval);

      app.signalk.removeListener('delta', handleDelta);
      debug("Stopped")
    }
  }

  function getTarget(app, trueWindSpeed, windInterval, trueWindAngle, twaInterval, speedThroughWater) {
    //debug("getTarget called")

    db.get(`SELECT * FROM polar
      WHERE environmentWindSpeedApparent < ?
      AND environmentWindSpeedApparent > ?
      ORDER BY performanceVelocityMadeGood
      DESC`, trueWindSpeed + windInterval, trueWindSpeed - windInterval, function(err, row){
        // error will be an Error if one occurred during the query
        if(err){
          debug("tack error: " + err.message);
        }

        if (row){

          //debug("target tack angle: " + row.environmentWindAngleTrueGround + " speed: " + row.navigationSpeedThroughWater);
          pushDelta(app,  {"key": "performance.beatAngle", "value": Math.abs(row.environmentWindAngleTrueGround)});
          pushDelta(app,  {"key": "performance.beatAngleTargetSpeed", "value": row.navigationSpeedThroughWater});
          pushDelta(app,  {"key": "performance.beatAngleVelocityMadeGood", "value": row.performanceVelocityMadeGood});
          if (Math.abs(trueWindAngle) < Math.PI/2){
            pushDelta(app,  {"key": "performance.targetAngle", "value": Math.abs(row.environmentWindAngleTrueGround)});
            pushDelta(app,  {"key": "performance.targetSpeed", "value": row.navigationSpeedThroughWater});
          }

        }
      }
    );

    db.get(`SELECT * FROM polar
      WHERE environmentWindSpeedApparent < ?
      AND environmentWindSpeedApparent > ?
      ORDER BY performanceVelocityMadeGood
      ASC`, trueWindSpeed + windInterval, trueWindSpeed - windInterval, function(err, row){

        // error will be an Error if one occurred during the query
        if(err){
          debug("gybe error: " + err.message);
        }

        if (row){

          //debug("target gybe angle: " + row.environmentWindAngleTrueGround + " speed: " + row.navigationSpeedThroughWater);
          pushDelta(app,  {"key": "performance.gybeAngle", "value": Math.abs(row.environmentWindAngleTrueGround)});
          pushDelta(app,  {"key": "performance.gybeAngleTargetSpeed", "value": row.navigationSpeedThroughWater});
          pushDelta(app,  {"key": "performance.gybeAngleVelocityMadeGood", "value": Math.abs(row.performanceVelocityMadeGood)});
          if (Math.abs(trueWindAngle) > Math.PI/2){
            pushDelta(app,  {"key": "performance.targetAngle", "value": Math.abs(row.environmentWindAngleTrueGround)});
            pushDelta(app,  {"key": "performance.targetSpeed", "value": row.navigationSpeedThroughWater});
          }


        }
      }
    );


    db.get(`SELECT * FROM polar
      WHERE environmentWindSpeedApparent < ?
      AND ABS(environmentWindAngleTrueGround) < ?
      AND ABS(environmentWindAngleTrueGround) > ?
      ORDER BY navigationSpeedThroughWater
      DESC`, trueWindSpeed, trueWindAngle, trueWindAngle - twaInterval, function (err, row) {

        // error will be an Error if one occurred during the query
        if(err){
          debug("polar error: " + err.message);
        }

        // results will contain the results of the query
        if (row){
          //debug("polarSpeed: " + row.navigationSpeedThroughWater + " ratio: " + speedThroughWater/row.navigationSpeedThroughWater)
          pushDelta(app,  {"key": "performance.polarSpeed", "value": row.navigationSpeedThroughWater});
          pushDelta(app,  {"key": "performance.polarSpeedRatio", "value": speedThroughWater/row.navigationSpeedThroughWater});
        }
      }
    );
  }
}

function getTrueWindAngle(speed, trueWindSpeed, apparentWindspeed, windAngle) {
  //cosine rule
  // a2=b2+c2−2bc⋅cos(A) where
  //a is apparent wind speed,
  //b is boat speed and
  //c is true wind speed

  var aSquared = Math.pow(apparentWindspeed,2);
  var bSquared = Math.pow(trueWindSpeed,2);
  var cSquared = Math.pow(speed,2);
  var cosA =  (aSquared - bSquared - cSquared) / (2 * trueWindSpeed * speed);

  if (windAngle === 0) {
    return 0;
  }
  else if (windAngle == Math.PI) {
    return Math.PI;
  }

  else if (cosA > 1 || cosA < -1){
    debug("invalid triangle aws: " + apparentWindspeed + " tws: " + trueWindSpeed + "bsp: " + speed);
    return null;
  }

  else {
    var calc;
    if (windAngle > 0 && windAngle < Math.PI){ //Starboard
      calc = Math.acos(cosA);
    } else if (windAngle < 0 && windAngle > -Math.PI){ //Port
      calc = -Math.acos(cosA);
    }
    return calc;
  }
}

function getTrueWindSpeed(speed, windSpeed, windAngle) {
  //debug("getTrueWindSpeed called")
  var apparentX = Math.cos(windAngle) * windSpeed;
  var apparentY = Math.sin(windAngle) * windSpeed;
  return Math.sqrt(Math.pow(apparentY, 2) + Math.pow(-speed + apparentX, 2));
}

function getVelocityMadeGood(speed, trueWindAngle) {
  //debug("getVelocityMadeGood called")
  return Math.cos(trueWindAngle) * speed;
}

function pushDelta(app, command_json) {
  var key = command_json["key"]
  var value = command_json["value"]


  const data = {
    context: "vessels." + app.selfId,
    updates: [
      {
        source: {"type":"server","sentence":"none","label":"calculated","talker":"signalk-polar"},
        timestamp: utilSK.timestamp(),
        values: [
          {
            'path': key,
            'value': value
          }
        ]
      }
    ],
  }

  app.signalk.addDelta(data)
  return
}
