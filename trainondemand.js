//Dialogflow: TrainOnDemand
'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const exps = express();
const request = require('request');
const crypto = require('crypto');
const StringBuilder = require("string-builder");
const zlib = require('zlib');
const fs = require("fs");
const { DialogflowApp } = require('actions-on-google');

let HAWK_HEADER_PREFIX = "hawk.1.header";
let SLF = "\n";

let ts = 0;
let get = 'GET';

let host = 'connectv3.smrt.wwprojects.com';
let hashq = 'q/t+NNAkQZNlq/aAD6PlexImwQTxwgT2MahfTa9XRLA=';
let key = 'h42325aqx6krj5z2uzm5e8wwqr2wchk5xq704n1e';
let hmac;
let mac;

let path_smrt = '/smrt';
let path_arrivaltime = '/api/train_arrival_time_by_id/?station=';

let speech = '';
let mrtstations = '';
let destination = '';
let done = 1;
let mrtstationname = '';
let mrtstationnameR = '';

let platform_ID;
let code;
let subseq_train_arr;
let next_train_destination;
let subseq_train_destination;
let next_train_arr; 

let str_min = '';
let askagain = ' Any other MRT station that you would like to know ?';

let ArrayMRT = [];
let ArrayMRTAll = [];

let IMG_URL_PICTURE = 'http://duocompass.com/img_sggothere/mrt.png';

// API.AI actions
const ACTION_MRT = 'action.MRT';
const ACTION_REFRESH = 'action.Refresh';


function genRandomString(length) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex') /** convert to hexadecimal format */
        .slice(0, length); /** return required number of characters */
};

function getBaseString(path, ts, type, hash, nonce) {
    let sb = new StringBuilder();
    sb.append(HAWK_HEADER_PREFIX).append(SLF);
    sb.append(ts).append(SLF);
    sb.append(nonce).append(SLF);
    sb.append(type).append(SLF);
    sb.append(path).append(SLF);
    sb.append(host).append(SLF);
    sb.append(443).append(SLF);
    sb.append(hash).append(SLF);
    sb.append('').append(SLF);
    //console.log(sb.toString());
    return sb;
}

function requestToken(callback) {
    let path = '/smrt/api/cdn_token/';
	ts = (Date.now() / 1000 | 0) + 700;
	let nonce = genRandomString(12).toUpperCase(); //'57CA1CCA2300';
	let sb = getBaseString(path, ts, get, hashq, nonce).toString();
    hmac = crypto.createHmac('sha256', key);
    hmac.write(sb);
    hmac.end();
    mac = new Buffer(hmac.read()).toString('base64');

    let headers = {
		'Connection': 'Keep-Alive',
        'User-Agent': 'SMRT Connect/3.0 Android/7.0',
        'Accept-Encoding': 'gzip',
		'Connection': 'Keep-Alive',
        'Content-Type': 'text/plain',
		'Referer': 'https://connectv3.smrt.wwprojects.com/smrt/',
        'Authorization': "Hawk id=\"ww-connectv3-android\",mac=\"" + mac + "\",hash=\"" + hashq + "\",ts=\"" + ts + "\",nonce=\"" + nonce + "\""
    }

    let options = {
        url: 'https://' + host + path,
        method: 'GET',
        headers: headers
    }
    //console.log(options);


    let requestWithEncoding = function(options, callback) {
        let req = request.get(options);

        req.on('response', function(res) {
            let chunks = [];
            res.on('data', function(chunk) {
                chunks.push(chunk);
            });

            res.on('end', function() {
                let buffer = Buffer.concat(chunks);
                let encoding = res.headers['content-encoding'];
                if (encoding == 'gzip') {
                    zlib.gunzip(buffer, function(err, decoded) {
                        callback(err, decoded && decoded.toString());
                    });
                } else if (encoding == 'deflate') {
                    zlib.inflate(buffer, function(err, decoded) {
                        callback(err, decoded && decoded.toString());
                    })
                } else {
                    callback(null, buffer.toString());
                }
            });
        });

        req.on('error', function(err) {
            callback(err);
        });
    }

    requestWithEncoding(options, function(err, data) {
        if (err) {
			console.log('requestToken err:' + err);
			callback('error');
		}
        else 
			callback(data);
    })
	

}

function uncapitalize(s) {
    return s[0].toLowerCase() + s.slice(1);
}

function capitalize(s) {
    return s[0].toUpperCase() + s.slice(1);
}

function getMRTAll(callback) {
	fs.readFile(__dirname+'/data/MRT.txt', 'utf8', function (err, data) {
		if (err) {
			console.log('error read data file:' + err);
			callback('error');
		}
		else {
			ArrayMRTAll = data.toString().split('\n');
			callback();
		}
	});
}

function requestArrivalTiming(stationcode, callback) {
	stationcode = encodeURI(stationcode.trim());
	ts = (Date.now() / 1000 | 0) + 700;
	let nonce = genRandomString(12).toUpperCase(); //'57CA1CCA2300';

    let sb = getBaseString(path_smrt + path_arrivaltime + stationcode, ts, get, hashq, nonce).toString();
    hmac = crypto.createHmac('sha256', key);
    hmac.write(sb);
    hmac.end();
    mac = new Buffer(hmac.read()).toString('base64');

    let headers = {
		'Connection': 'Keep-Alive',
        'User-Agent': 'SMRT Connect/3.0 Android/7.0',
        'Accept-Encoding': 'gzip',
		'Connection': 'Keep-Alive',
        'Content-Type': 'text/plain',
		'Referer': 'https://connectv3.smrt.wwprojects.com/smrt/',
        'Authorization': "Hawk id=\"ww-connectv3-android\",mac=\"" + mac + "\",hash=\"" + hashq + "\",ts=\"" + ts + "\",nonce=\"" + nonce + "\""
    }

    let url = host + path_smrt + path_arrivaltime + stationcode;
    let options = {
        url: 'https://' + url,
        method: 'GET',
        headers: headers,
    }
    //console.log(options);

    let requestWithEncoding = function(options, callback) {
        let req = request.get(options);

        req.on('response', function(res) {
            let chunks = [];
            res.on('data', function(chunk) {
                chunks.push(chunk);
            });

            res.on('end', function() {
                let buffer = Buffer.concat(chunks);
                let encoding = res.headers['content-encoding'];
                if (encoding == 'gzip') {
                    zlib.gunzip(buffer, function(err, decoded) {
                        callback(err, decoded && decoded.toString());
                    });
                } else if (encoding == 'deflate') {
                    zlib.inflate(buffer, function(err, decoded) {
                        callback(err, decoded && decoded.toString());
                    })
                } else {
                    callback(null, buffer.toString());
                }
            });
        });

        req.on('error', function(err) {
            callback(err);
        });
    }

    requestWithEncoding(options, function(err, data) {
        if (err) {
			console.log('requestArrivalTiming err:' + err);
			callback('error');
        } else 
			//console.log(data);
			callback(data);
    })

}

function getStations(keypairid, signature, policy, callback) {
    let path = '/autoupdate_data/stations.json?Key-Pair-Id=' + keypairid + '&Signature=' + signature + '&Policy=' + policy;

    let headers = {
		'Connection': 'Keep-Alive',
        'User-Agent': 'SMRT Connect/3.0 Android/7.0',
        'Accept-Encoding': 'gzip',
		'Connection': 'Keep-Alive',
        'Content-Type': 'text/plain',
		'Referer': 'https://connect.smrt.wwprojects.com/smrt/',
    }

    let options = {
        url: 'http://connect-v3-cdn.smrt.wwprojects.com' + path,
        method: 'GET',
        headers: headers
    }
    //console.log(options);


    let requestWithEncoding = function(options, callback) {
        let req = request.get(options);

        req.on('response', function(res) {
            let chunks = [];
            res.on('data', function(chunk) {
                chunks.push(chunk);
            });

            res.on('end', function() {
                let buffer = Buffer.concat(chunks);
                let encoding = res.headers['content-encoding'];
                if (encoding == 'gzip') {
                    zlib.gunzip(buffer, function(err, decoded) {
                        callback(err, decoded && decoded.toString());
                    });
                } else if (encoding == 'deflate') {
                    zlib.inflate(buffer, function(err, decoded) {
                        callback(err, decoded && decoded.toString());
                    })
                } else {
                    callback(null, buffer.toString());
                }
            });
        });

        req.on('error', function(err) {
            callback(err);
        });
    }

    requestWithEncoding(options, function(err, data) {
        if (err) {
			console.log('requestToken err:' + err);
			callback('error');
		}
        else 
			callback(data);
    })
	

}
function getMRTTrainArrival(stationname, cb) {
	ArrayMRT = [];
	let speech = '';
	console.log('stationname: ' + stationname);
	requestArrivalTiming(stationname, function(returnValue) {
		if(returnValue != 'error') {
			let data = JSON.parse(returnValue);
			let platform;
			let line;

			if(data.results.length > 0) {
				for(let i=0; i < data.results.length; i++) {

					platform_ID = data.results[i].platform_ID;
					code = data.results[i].code
					subseq_train_arr = data.results[i].subseq_train_arr;
					next_train_destination = data.results[i].next_train_destination;
					subseq_train_destination = data.results[i].subseq_train_destination;
					next_train_arr = data.results[i].next_train_arr;

					platform = data.results[i].platform_ID;
					destination = data.results[i].next_train_destination;

					for(let j=0; j < ArrayMRTAll.length; j++) {
						if(ArrayMRTAll[j].split(':')[0] == platform){
							line = ArrayMRTAll[j].split(':')[1].trim();
							break;
						}
					}

					if(destination == '') {
						for(let k=0; k < mrtstations.length; k++) {
							for (let m=0; m < mrtstations[k].direction.length; m++) {
								if(mrtstations[k].direction[m].platform == platform) {
									destination = uncapitalize(mrtstations[k].direction[m].to);
								}
							}
						}
					} else 
						destination = 'To ' + destination + ' (' + line + ')';

					if(Number(next_train_arr) > 1)
						str_min =  next_train_arr + ' minutes'
					else
						str_min = 'a minute'		

					platform = platform.split('_')[1];

					if(next_train_arr == 'Arr')
							speech = speech + 'Train ' + destination + ' at platform ' + platform +  ' has arrived. ';
						else if(next_train_arr === '' || next_train_arr == 'N/A')	
							speech = speech + ' No train information available at platform ' + platform + '. ';
						else
							speech = speech + 'Train ' + destination + ' at platform ' + platform + ' will arrive in ' + str_min + '. ';
										
					ArrayMRT.push({
						'code': code,
						'subseq_train_arr' : subseq_train_arr,
						'next_train_destination' : next_train_destination,
						'subseq_train_destination' : subseq_train_destination,
						'next_train_arr' : next_train_arr,
						'destination' : destination,
						'platform' : platform,
						'stationname' : stationname
                     });

					if(done == data.results.length) {
						//console.log('speech: ' + speech);
						cb(speech + '|' + stationname);
					}
					done++;

				}
			} else {
				speech = 'I couldn\'t find the information for this MRT station. Can you please tell me again the station name ?|' + 'notavailable';
				//console.log(speech);
				cb(speech);
			}

		};
	});
}

function getMRTTrainArrival_Process(app, mrtstationname) {
	let descr = '';
	getMRTTrainArrival(mrtstationname, function(returnValue) {
		if (returnValue.split('|')[1] == 'notavailable') 
			app.ask(capitalize(returnValue.split('|')[0].trim()));
		else {

			//console.log(ArrayMRT);
			if(ArrayMRT.length > 1) {
				let list = app.buildList(returnValue.split('|')[1]);

				for (let i = 0; i < ArrayMRT.length; i++) {
					if(ArrayMRT[i].next_train_arr == 'Arr')
						descr = ArrayMRT[i].destination  + '. Arrived. Subsequent Train: ' +  ArrayMRT[i].subseq_train_arr + ' min(s).';
					else
						descr = ArrayMRT[i].destination + '. Next Train: ' + ArrayMRT[i].next_train_arr + ' min(s). Subsequent Train: ' + ArrayMRT[i].subseq_train_arr + ' min(s).';

					list.addItems(app.buildOptionItem(ArrayMRT[i].stationname + '|' + i, [ArrayMRT[i].stationname + '|' + i])
						.setTitle(i+1 +'. Platform ' + ArrayMRT[i].platform)
						.setDescription(descr)
						.setImage(IMG_URL_PICTURE, 'image' + i))
				}

				app.askWithList(app.buildRichResponse()
					.addSuggestions(['Refresh'])
					.addSimpleResponse('Here you go. ' + askagain), list);
				} 
			else 
				app.ask(app.buildRichResponse()
					.addSimpleResponse({speech: capitalize(returnValue.split('|')[0]) + askagain,
					  displayText: capitalize(returnValue.split('|')[0]) + askagain})
					.addSuggestions(['Refresh'])
				);
		}
	});
}

function main() {
	requestToken(function(returnValue) {
		if(returnValue != 'error') {
			returnValue = JSON.stringify(JSON.parse(returnValue).results).split(':').splice(0)[2];

			let returnValueP = returnValue.search("Policy=");
			let returnValueS = returnValue.search("Signature=");
			let returnValueK  = returnValue.search("Key-Pair-Id=");

			returnValueP = returnValue.substring(returnValueP + 7, returnValueS-1);
			returnValueS = returnValue.substring(returnValueS + 10, returnValueK-1);
			returnValueK = returnValue.substring(returnValueK + 12, returnValue.length-2);

			getStations(returnValueK, returnValueS, returnValueP, function(returnValue) {
				mrtstations = JSON.parse(returnValue);
				
				getMRTAll(function(returnValue) {
					//Start of the Program
					init();
				});
			});
		}
	});
}

function init() {
	exps.use(bodyParser.json());

	exps.post('/hook', function(request, response) {
		const app = new DialogflowApp({request, response});
		//console.log('Request headers: ' + JSON.stringify(request.headers));
		//console.log('Request body: ' + JSON.stringify(request.body));
		
		function MRTIntent(app) {
			mrtstationname = app.getArgument('MRTStation');

			//const param = app.getArgument('OPTION');

			if (mrtstationname == null) 
				mrtstationname = app.getSelectedOption().split('|')[0];
			

			console.log('mrtstationname: ' + mrtstationname);
			mrtstationnameR = mrtstationname;
			done = 1;
		    			
			getMRTTrainArrival_Process(app, mrtstationname);
		}

		function RefreshIntent(app) {
			done = 1;
			console.log('mrtstationnameR: ' + mrtstationnameR);
			getMRTTrainArrival_Process(app, mrtstationnameR);
        }

		const actionMap = new Map();
		actionMap.set(ACTION_MRT, MRTIntent);
		actionMap.set(ACTION_REFRESH, RefreshIntent);
		app.handleRequest(actionMap);
	});

	exps.listen((process.env.PORT || 8000), function() {
		console.log("TrainOnDemand: App up and running, listening.")
	})
}

function test() {
	requestArrivalTiming(encodeURI('Commonwealth'), function(returnValue) {
		console.log(JSON.parse(returnValue));
	});
}

main();


