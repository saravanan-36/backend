const mongoose = require('mongoose');
const todoSchema = new mongoose.Schema({
    title:{type:String,required:true},
    completed:{type:Boolean,default:false},
});
const taskSchema=new mongoose.Schema({
    title:{type:String,required:true},
    description:{type:String,required:true},
    status:{type:String,enum:['pending','in-progress','completed'],default:'pending'},
    priority:{type:String,enum:['low','medium','high'],default:'low'},
    dueDate:{type:Date,default:Date.now},
    assignedTo: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
],

    createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
    attachments:[{type:String}],
    todoChecklist:[todoSchema],
    progress:[{type:Number,default:0}],
},
{timestamps:true});


module.exports=mongoose.model('Task',taskSchema);
// module.exports=mnongoose.model('Todo',todoSchema);
