/**
 * # Logger module
 * 
 * ## Description
 *
 * Initially created to create log files (rotate daily) for ep_mypads. (02/2021)
 * 
 */

var winston           = require('winston');
var winstonRotate     = require('winston-daily-rotate-file');
var path              = require('path');

var getFileRotateTransport = function(logLevel) {
  var logDir = 'logs';
  var filePrefix = (logLevel == 'error') ? 'err' : 'inf' 
  return new (winston.transports.DailyRotateFile)({
    filename: path.resolve(`${logDir}/${filePrefix}.%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    maxsize: 50000000,
    maxFiles: '7d',
    level: logLevel
  });
}

const logConfiguration = {
  'transports': [
      getFileRotateTransport('error'),
      getFileRotateTransport('info')
  ],
  'format': winston.format.combine(
      winston.format.timestamp({
         format: 'DD-MM-YYYY HH:mm:ss:SSS'
     }),
      winston.format.printf(info => `${[info.timestamp]} [${(info.level.substring(0,3)).toUpperCase()}]: ${info.message}`),
      winston.format.errors({stack:true})
  )
};

var logger = winston.createLogger(logConfiguration);
Object.defineProperty(exports, "wLogger", {value: logger});