const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const taskSchema = new mongoose.Schema({
  title: String,
  done: {
    type: Boolean,
    default: false
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);


module.exports = {
    User,
    Task
}