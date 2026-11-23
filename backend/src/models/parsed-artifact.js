const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  screenshot_id: { type: Number, required: true, unique: true },
  text: { type: String, default: '' },
  structured: {
    type: new mongoose.Schema({
      parserVersion: String,
      platform: String,
      visual: {
        type: new mongoose.Schema({
          method: String, incomingSide: String, imageWidth: Number, imageHeight: Number,
          region: { x: Number, y: Number, width: Number, height: Number },
          candidates: [{ _id: false, text: String, x: Number, y: Number, width: Number, height: Number, side: String, direction: String }],
        }, { _id: false }), default: undefined,
      },
      usernames: [String],
      dates: [String],
      messages: [{ _id: false, lineNumber: Number, endLineNumber: Number, text: String,
        sender: String, displayedDate: String, displayedTime: String, layout: String }],
    }, { _id: false }),
    default: undefined,
  },
  status: { type: String, enum: ['pending', 'parsed', 'failed'], default: 'pending' },
  error: { type: String, default: null },
  data: mongoose.Schema.Types.Mixed,
}, { collection: 'parsed_artifacts', timestamps: true, versionKey: false });

module.exports = mongoose.model('ParsedArtifact', schema);
