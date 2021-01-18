var mongoose=require("mongoose"),
    Comment =require("./comment");
    const fileSchema = new mongoose.Schema({
      url: String,
      filename: String
  });
  fileSchema.virtual('thumbnail').get(function () {
    return this.url.replace('/upload', '/upload/w_200');
});
  const entertainmentSchema = new mongoose.Schema({
  name: String,
  category:String,
  price : String,
  files: [fileSchema],
  likes: [
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
  ],
	description: String,
  author : {   
            id: {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: "User"
                },
            firstname:String,
            lastname :String,
            username: String

            },
  comments: [
      {
         type: mongoose.Schema.Types.ObjectId,
         ref: "Comment"
      }
            ],
  rating: [
           {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: 'Rating'
           }
          ]
},{
  timestamps:true
}
);

entertainmentSchema.path('files').validate((value)=> {
  if(value.length > 2 ){
      throw new Error("Files cannot be uploaded more than 2")
  }
})
module.exports = mongoose.model("Entertainment",entertainmentSchema);