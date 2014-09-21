'use strict';

var util = require('util');
var stream = require('stream');
var http = require('http');
var lds = require('lodash');
var options = {
  host: '10.0.1.2',
  port: 56780,
  path: '/lights.json'
}

util.inherits(Driver, stream);
util.inherits(Bulb, stream);
module.exports = Driver;

function Driver(opts,app) {
  var self = this;

  this._app = app;
  this._opts = opts;
  this._opts.stations = opts.stations || [];

  var devices = {};

  app.once('client::up', function() {
    self.log.info('Firing up!');

    http.get(options, function(resp){
      resp.on('data', function(body){
        body = JSON.parse(body);

        lds.each(body, function(bulb) {
          self.log.info('New bulb found: ', bulb['label']);

          var device  = new Bulb(bulb);
          if (!devices[device.G]) {
            self.log.info('Registering bulb');
            devices[device.G] = device;

            self.emit('register', device);
          }
        });
      });
    }).on("error", function(e){
      console.log("Got error: " + e.message);
    });
  });
}

function Bulb(bulb) {
  var self = this;
  this.bulb = bulb;
  this.writeable = true;
  this.readable = true;
  this.V = 0;
  this.D = 1008;
  this.G = 'Lifx' + this.bulb['id'];
  this.name = 'Lifx - ' + (this.bulb['label']||'(No Name)');

  http.get(options, function(resp) {
    resp.on('data', function(body) {
      body = JSON.parse(body);

      lds.each(body, function(bulb) {
        if (bulb['id'] === self.bulb['id']) {
          self.emit('data', {
            hue: bulb['color']['hue'],
            sat: bulb['color']['saturation'],
            bri: bulb['color']['brightness'],
            on: bulb['on'],
          });
        }
      });
    });
  }).on("error", function(e){
    console.log("Got error: " + e.message);
  });
}

Bulb.prototype.write = function(data) {
  var self = this;

  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  if (!data.on) {
    options['method'] = 'PUT';
    options['path'] = '/lights/' + self.bulb['id'] + '/off';

    http.request(options, function(res) {
      console.log('Light Off' + self.bulb['label']);
    }).end();
  }

  if (data.hue && data.sat && data.bri) {
    options['method'] = 'PUT';
    options['path'] = '/lights/' + self.bulb['id'] + '/color?hue=' + data.hue +
      '&saturation=' + data.sat + '&brightness=' + data.bri + '&duration=' +
      data.transitionTime || 2;

    http.request(options, function(res) {
      console.log('Light Colored' + self.bulb['label']);
    }).end();
  }

  if (data.on) {
    options['method'] = 'PUT';
    options['path'] = '/lights/' + self.bulb['id'] + '/on';

    http.request(options, function(res) {
      console.log('Light On' + self.bulb['label']);
    }).end();
  }
};
