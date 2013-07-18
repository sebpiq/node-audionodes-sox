var _ = require('underscore')
  , spawn = require('child_process').spawn
  , EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , async = require('async')
  , StreamDecoder = require('pcm-boilerplate').StreamDecoder
  , AudioBuffer = require('audiobuffer')
  , getFileFormat = require('./utils').getFileFormat

// Example usage :
//    var effect = new SoxEffect('mySound.wav', 'stretch', 2, 10)
var SoxEffect = module.exports.SoxEffect = function(filename) {
  var self = this
    , effectArgs = _.toArray(arguments).slice(1)
    // full command w/ opts : sox input.wav -t raw -L -e signed -r 44100 -b 16 -c 2 - EFFECT [ARGS]
    , args = [filename, '-t', 'raw'].concat(effectArgs)
  this.process = spawn('sox', args)
  this.process.on('close', function(code) { self._returnCode = code })
  this.process.stderr.on('data', function(data) {
    console.log('stderr: ' + data)
  })

  this.format = null            // The Node is ready only when this is set
  this._audioBuffer = null      // This is a buffer that helps us returning only blocks with BLOCK_SIZE
  this._streamDecoder = new StreamDecoder(this.process.stdout, {bitDepth: 32, numberOfChannels: 2})
  this._error = null
  this._returnCode = null

  this.getFileFormat(filename, function(err, format) {
    if (err) return self.emit('error', err)
    self.format = format
    self._audioBuffer = self._makeAudioBuffer(0)
    self.emit('ready', format)
  })
}
inherits(SoxEffect, EventEmitter)


_.extend(SoxEffect.prototype, {

  pullAudio: function(done) {
    // This will be the pullAudio method after successful
    // initialization
    var pullAudio = function(done) {
      var self = this
      async.whilst(
        function() { return self._audioBuffer.length < self.context.BLOCK_SIZE },
        function(next) {
          this._streamDecoder.pullBlock(function(err, block) {
            if (err) return next(err)

            self._audioBuffer = self._audioBuffer.concat()
          })
        },
        function(err) {

        }
      )


    }

    // This will be executed only the first time, when the node hasn't finished
    // initialization
    var self = this
    if (!this.format) {
      var onReady = function() {
        self.removeListener('error', onError)
        self.pullAudio = pullAudio
        self.pullAudio(done)
      }
      var onError = function(err) {
        self.removeListener('ready', onReady)
        self.pullAudio = function(done) {
          done(new Error('SoxEffect couldn\'t initialize properly'))
        }
        done(err)
      }
      this.once('ready', onReady)
      this.once('ready', onError)
    }
  },

  _makeAudioBuffer = function(length) {
    return new AudioBuffer(this.format.numberOfChannels, length, this.format.sampleRate)
  }

})

var sox = new SoxEffect('./powerpad.wav', 'stretch', 1.5, 15)
  , fs = require('fs')
  , async = require('async')
  , fileStream = fs.createWriteStream('stretched.wav')
  , streamEncoder = new (require('./utils').StreamEncoder)(fileStream, {bitDepth: 16, numberOfChannels: 2})
  , writing = true

async.whilst(
  function() { return writing },
  function(next) {
    sox.pullAudio(function(err, data) {
      if (data) {
        //console.log(_.toArray(data[0].slice(0, 10)), _.toArray(data[1].slice(0, 10)))
        //console.log('writing ' + data[0].length + ' samples')
        streamEncoder.pushBlock(data, next)
      } else {
        writing = false
        next()
      }
    })
  },
  function() {
    console.log('OVER')
  }
)