var assert = require('assert')
  , utils = require('../lib/utils')

describe('parseFormat', function() {
  
  it('should parse string from soxi and return a format', function() {
    var soxiInfos = "Input File     : 'powerpad.wav'\n"
                  + "Channels       : 2\n"
                  + "Sample Rate    : 44100\n"
                  + "Precision      : 16-bit\n"
                  + "Duration       : 00:00:08.41 = 370944 samples = 630.857 CDDA sectors\n"
                  + "File Size      : 1.48M\n"
                  + "Bit Rate       : 1.41M\n"
                  + "Sample Encoding: 16-bit Signed Integer PCM\n"
      , format = utils.parseFormat(soxiInfos)
    assert.deepEqual(Object.keys(format).sort(), ['bitDepth', 'numberOfChannels', 'sampleRate'].sort())
    assert.equal(format.numberOfChannels, 2)
    assert.equal(format.sampleRate, 44100)
    assert.equal(format.bitDepth, 16)
  })
  
})

describe('getFileFormat', function() {

  it('should get the format of an audio file that exists', function(done) {
    utils.getFileFormat(__dirname + '/sounds/powerpad.wav', function(err, format) {
      assert.ok(!err)
      assert.deepEqual(Object.keys(format).sort(), ['bitDepth', 'numberOfChannels', 'sampleRate'].sort())
      assert.equal(format.numberOfChannels, 2)
      assert.equal(format.sampleRate, 44100)
      assert.equal(format.bitDepth, 16)
      done()
    })
  })

  it('should return an error if the file doesn\'t exist', function(done) {
    utils.getFileFormat(__dirname + '/sounds/wotwotwot.wav', function(err, format) {
      assert.ok(err)
      assert.ok(!format)
      done()
    })
  })

  it('should return an error if the file isn\'t a soundfile', function(done) {
    utils.getFileFormat(__filename, function(err, format) {
      assert.ok(err)
      assert.ok(!format)
      done()
    })
  })

})