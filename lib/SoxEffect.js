var _ = require('underscore')
  , spawn = require('child_process').spawn
  , inherits = require('util').inherits
  , inspect = require('util').inspect
  , async = require('async')
  , debug = require('debug')('SoxEffect')
  , StreamDecoder = require('pcm-boilerplate').StreamDecoder
  , AudioBuffer = require('audiobuffer')
  , getFileFormat = require('./utils').getFileFormat
  , BLOCK_SIZE = require('web-audio-api').constants.BLOCK_SIZE
  , AudioNode = require('web-audio-api').AudioNode

// Example usage :
//    var effect = new SoxEffect(context, 'mySound.wav', 'stretch', 2, 10)
var SoxEffect = module.exports = function(context, filename) {
  AudioNode.call(this, context, 0, 1)
  var self = this
    // full command w/ opts : sox input.wav -t raw -L -e signed -r 44100 -b 16 -c 2 - EFFECT [ARGS]
    , args = [filename, '-t', 'raw', '-L', '-e', 'signed']
    , effectArgs = _.toArray(arguments).slice(2)

  this.process = null               // the sox process
  this.format = null                // the Node is ready only when we got this through soxi
  this._streamDecoder = null        // this decodes the PCM stream created by sox to actual arrays

  this._blocks = []
  this._blocksLength = 10
  this._pullingBlocksLock = false   // Avoid to start pulling blocks if we are already doing it

  this._error = null
  this._returnCode = null
  this._ended = false               // Flag to tell that the stream is finished - all the data has been consumed

  // We can fully initialize only when we received the file format
  getFileFormat(filename, function(err, format) {
    if (err) return self.emit('error', err)
    self.format = format
    debug('found format ' + inspect(format))
    args = args.concat(['-r', self.context.sampleRate, '-b', format.bitDepth, '-c', format.numberOfChannels, '-']).concat(effectArgs)
    debug('running : ' + ['sox'].concat(args).join(' '))

    // Process and stream
    self.process = spawn('sox', args)
    self._streamDecoder = new StreamDecoder(format, {pad: true})
    self.process.stdout.pipe(self._streamDecoder)

    // Handling end of the process
    self.process.on('close', function(code) {
      debug('sox process closed')
      self._returnCode = code
    })
    self._streamDecoder.on('end', function() {
      debug('end of sox stream')
      self._streamDecoder.removeAllListeners('readable')
      self._ended = true
    })

    // Error handling
    self.process.stderr.on('data', function(data) {
      var msg = data.toString()
      if (msg.indexOf('sox WARN') === 0) console.warn(msg)
      else self.emit('error', data.toString())
    })

    // First pull a bunch of blocks before emitting the 'ready' signal
    self._pullBlocks(function(err) {
      if (err) return self.emit('error', err)
      debug('node ready')
      self.emit('ready')
    })
  })
}
inherits(SoxEffect, AudioNode)


_.extend(SoxEffect.prototype, {

  _tick: function() {
    var block
    this._pullBlocks()
    if (this._ended && !this._blocks.length) this.emit('end')
    if (this._blocks.length) block = this._blocks.shift()
    else block = new AudioBuffer(this.format.numberOfChannels, BLOCK_SIZE, this.context.sampleRate) 
    return block
  },

  // !!! If the stream ends, `done` won't be called
  _pullBlocks: function(done) {
    if (!this._pullingBlocksLock && !this._ended) {
      this._pullingBlocksLock = true
      var self = this
        , block
      async.whilst(
        function() { return (self._blocks.length < self._blocksLength) && !self._ended },
        function(next) {
          block = self._streamDecoder.read(BLOCK_SIZE)
          if (block) {
            self._blocks.push(AudioBuffer.fromArray(block, self.context.sampleRate))
            next()
          } else self._streamDecoder.once('readable', next)
        },
        function(err) {
          if (done) done(err)
          else if (err) return self.emit('error', err)
          self._pullingBlocksLock = false
        }
      )
    }
  }

})