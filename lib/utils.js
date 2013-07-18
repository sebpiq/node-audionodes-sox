var spawn = require('child_process').spawn

var lineRegex = /^([^:]+):(.+)$/
  , trailingSpaceRegex = /(^\s+|\s+$)/g

// Parse info returned by soxi and returns an object containing following entries :
//    - bitDepth
//    - sampleRate
//    - numberOfChannels
var parseFormat = module.exports.parseFormat = function(infoStr) {
  var lines = infoStr.split('\n')
    , format = {}
    , lineResult, fieldName, fieldVal

  lines.forEach(function(line) {
    lineResult = lineRegex.exec(line)
    if (lineResult !== null) {
      fieldName = lineResult[1].replace(trailingSpaceRegex, '')
      fieldName = {
        'Channels': 'numberOfChannels',
        'Sample Rate': 'sampleRate',
        'Precision': 'bitDepth',
      }[fieldName]

      if (fieldName) {
        if (fieldName === 'numberOfChannels')
          fieldVal = parseInt(lineResult[2], 10)
        else if (fieldName === 'sampleRate')
          fieldVal = parseInt(lineResult[2], 10)
        else if (fieldName === 'bitDepth')
          fieldVal = parseInt(lineResult[2], 10)
        if (isNaN(fieldVal)) throw new Error('invalid ' + fieldName + ' : ' + lineResult[2])
        format[fieldName] = fieldVal
      }
    }
  })

  return format
}

// Uses soxi to get the format of `filename`
var getFileFormat = module.exports.getFileFormat = function(filename, done) {
  var soxi = spawn('sox', ['--info', filename])
    , off = function() {
      soxi.stdout.removeAllListeners('readable')
      soxi.stdout.removeAllListeners('error')
      
    }
  // It appears sometimes the first reads return null, so we'll just
  // read until we get something.
  soxi.stdout.on('readable', function() {
    var formatStr = soxi.stdout.read()
    if (formatStr) {
      soxi.stderr.removeAllListeners('readable')
      off()
      done(null, parseFormat(formatStr.toString('ascii')))
    }
  })

  soxi.stderr.on('readable', function() {
    off()
    var errorStr = soxi.stderr.read()
    if (errorStr) {
      soxi.stdout.removeAllListeners('readable')
      done(errorStr.toString('ascii'))
    }
  })
}