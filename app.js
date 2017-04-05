var express = require('express.io')
var uuid = require('uuid');
var EventHubClient = require('azure-event-hubs').Client;
var IotHubClient = require('azure-iothub').Client;
var Message = require('azure-iot-common').Message;

app = express().http().io()

var iotHubConnectionString = process.env.THINGLABS_IOTHUB_CONNSTRING || ''
var eventHubConnectionString = process.env.THINGLABS_EVENTHUB_CONNSTRING || ''
var eventHubName = process.env.THINGLABS_EVENTHUBNAME || 'thinglabseventhub'
var client = EventHubClient.fromConnectionString(eventHubConnectionString, eventHubName)

// Setup your sessions, just like normal.
app.use(express.cookieParser())
app.use(express.session({secret: 'thinglabs'}))

// Session is automatically setup on initial request.
app.get('/', function(req, res) {
    req.session.loginDate = new Date().toString()
    res.sendfile(__dirname + '/index.html')
});

app.post('/:deviceId/led/:state', function (req, res) { 
    var deviceId = req.params.deviceId;
    var ledState = req.params.state;   
    //var messageData = '{"ledState":' + ledState + '}';
//    {
//    "commandType": "iodb_write",
//    "commandId":"<custom_command_id>",
//    "iodb": {
//        "<tag_name>": "<desired value>"
//    }
//}
    var messageData = '{"commandType": "iodb_write","commandId":"ledCommand101","iodb": {"DO2": '+ ledState '}}'
    var client = IotHubClient.fromConnectionString(iotHubConnectionString);
    client.open(function (err) {
        if (err) {
            console.Log('Could not open the connection to the service: ' + err.message);
        } else {
            client.send(deviceId, messageData, function (err) {
                if (err) {
                    console.Log('Could not send the message to the service: ' + err.message);
                } else {
                    client.close(function (err) {
                        if (err) {
                            console.Log('Could not close the connection to the service: ' + err.message);
                        }
                    });
                }
            });
        }
    });
    
    res.status(200).end();
});

app.use(express.static(__dirname + '/static'));

// Instantiate an eventhub client

app.io.route('ready', function(req) {
    // For each partition, register a callback function
    client.getPartitionIds().then(function(ids) {
        ids.forEach(function(id) {
            var minutesAgo = 5;
            var before = (minutesAgo*60*1000);
            client.createReceiver('$Default', id, { startAfterTime: Date.now() - before })
                .then(function(rx) {
                    rx.on('errorReceived', function(err) { console.log(err); });
                    rx.on('message', function(message) {
                        console.log(message.body);
                        var body = message.body;
                        try {
                            app.io.broadcast('data', body);
                        } catch (err) {
                            console.log("Error sending: " + body);
                            console.log(typeof(body));
                        }
                    });
                });
        });
    });
});

app.listen(process.env.port || 7076)