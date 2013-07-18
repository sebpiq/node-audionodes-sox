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
var SoxEffect = module.exports = function(context, filename) {

  var self = this
    // full command w/ opts : sox input.wav -t raw -L -e signed -r 44100 -b 16 -c 2 - EFFECT [ARGS]
    , args = [filename, '-t', 'raw', '-L', '-e', 'signed']
    , effectArgs = _.toArray(arguments).slice(1)

  this.context = context
  this.process = null           // the sox process
  this.format = null            // the Node is ready only when we got this through soxi
  this._audioBuffer = null      // this is a buffer that helps us returning only blocks with BLOCK_SIZE
  this._streamDecoder = null    // this decodes the PCM stream created by sox to actual arrays

  this._error = null
  this._returnCode = null

  // We can fully initialize only when we received the file format
  getFileFormat(filename, function(err, format) {
    if (err) return self.emit('error', err)
    self.format = format
    args = args.concat('-r', format.sampleRate, '-b', format.bitDepth, '-c', format.numberOfChannels, '-').concat(effectArgs)
    console.log(args)

    self.process = spawn('sox', args)
    self.process.on('close', function(code) { self._returnCode = code })
    self.process.stderr.on('data', function(data) {
      console.log('stderr: ' + data)
    })
    self._streamDecoder = new StreamDecoder(self.process.stdout, {bitDepth: 32, numberOfChannels: 2})
    self._audioBuffer = self._makeAudioBuffer(0)
    self.emit('ready', format)
  })
}
inherits(SoxEffect, EventEmitter)


_.extend(SoxEffect.prototype, {

  pullAudio: function(done) {

    // This will be the pullAudio method after successful
    // initialization
    var blockSize = this.context.BLOCK_SIZE
    var pullAudio = function(done) {
      var self = this
      async.whilst(
        function() { return self._audioBuffer.length < blockSize },
        function(next) {
          self._streamDecoder.pullBlock(function(err, block) {
            if (err) return next(err)
            var audioBuffer
            if (block !== null) {
              audioBuffer = AudioBuffer.fromArray(block)
              self._audioBuffer = self._audioBuffer.concat(audioBuffer)
              next()
            } else {
              var zeros = self._makeAudioBuffer(blockSize - self._audioBuffer.length)
              self._audioBuffer = self._audioBuffer.concat(zeros)
              self.pullAudio = pullAudioClosed
              next()
            }
          })
        },
        function(err) {
          done(null, self._audioBuffer.slice(0, blockSize))
          self._audioBuffer = self._audioBuffer.slice(blockSize)
        }
      )
    }

    // This will be the pullAudio method once all the audio has been read
    var pullAudioClosed = function(done) {
      done(null, self._makeAudioBuffer(blockSize))
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
      this.once('error', onError)
    }
  },

  _makeAudioBuffer: function(length) {
    return new AudioBuffer(this.format.numberOfChannels, length, this.format.sampleRate)
  }

})