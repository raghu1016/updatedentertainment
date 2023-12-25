var express = require("express");
var router  = express.Router();
var Entertainment= require("../models/entertainment")
var User = require("../models/user");
var Notification = require("../models/notification");
var Rating = require("../models/rating");
var middleware = require("../middleware")
var multer = require('multer');
var path = require("path");
const {storage, cloudinary } = require('../cloudinary');
const upload = multer({storage});

//index route
router.get("/",(req,res)=>{
	// console.log(req.user)
	var noMatch=null;
// console.log(req.query.search)
	if(req.query.search){
			// console.log(req.query.search)

	const regex = new RegExp(escapeRegex(req.query.search), 'gi');
	Entertainment.find({ $or: [ { name: regex }, { category: regex } ] },function(err,allentertainments){
	// Entertainment.find({name:regex},function(err,allentertainments){
		// console.log(regex)
		if(err){
			console.log(err);
		       } 
		else{
			if(allentertainments.length<1){
				noMatch="no entertainment found for this search"
			}
		    res.render("entertainment/index",{entertainment:allentertainments,noMatch:noMatch})
		// console.log(allentertainments)
		// console.log(allentertainments.name)
              }
                                                                  })
}else{
	Entertainment.find({},function(err,allentertainments){
		if(err){
			console.log(err)
		} else{
			res.render("entertainment/index",{entertainment:allentertainments,noMatch:noMatch})
		}
	})
}
})

// created route	
router.post("/",middleware.isLoggedIn,upload.array('files'),async function(req, res){
	try {
		const entertainment = new Entertainment(req.body);
	entertainment.files = req.files.map(f => ({ url: f.path, filename: f.filename }));
	entertainment.author = {id: req.user._id, firstname: req.user.firstname, lastname: req.user.lastname, username: req.user.username};
	await entertainment.save();
	let user = await User.findById(req.user._id).populate('followers').exec();
    let newNotification = {
        username: req.user.username,
        entertainmentId: entertainment._id
    }
    for(const follower of user.followers) {
        let notification = await Notification.create(newNotification);
        follower.notifications.push(notification);
        follower.save();
	}
	req.flash("success","new entertainment created")
	res.redirect('/entertainment');
	} catch (error) {
		req.flash('error', error.errors.files.message);
	  	res.redirect(`/entertainment/new`)	
	}
});
	  
router.get("/movie",middleware.isLoggedIn,(req, res)=>{
	Entertainment.find({'category':'Movie'},function(err,allentertainments){
		if(err){
			console.log(err);
		} else{
			// console.log("movies list ",allentertainments)
		res.render("entertainment/movie",{entertainment:allentertainments})
	}
})
})
router.get("/tv",middleware.isLoggedIn,(req, res)=>{
	Entertainment.find({'category':'TV show'},function(err,allentertainments){
		if(err){
			console.log(err);
		} else{
			// console.log("movies list ",allentertainments)
		res.render("entertainment/tv",{entertainment:allentertainments})
	}
})
})

router.get("/music",middleware.isLoggedIn,(req, res)=>{
	Entertainment.find({'category':'Music'},function(err,allentertainments){
		if(err){
			console.log(err);
		} else{
			// console.log("movies list ",allentertainments)
		res.render("entertainment/music",{entertainment:allentertainments})
	}
})
})

router.get("/sport",middleware.isLoggedIn,(req, res)=>{
	Entertainment.find({'category':'Sport'},function(err,allentertainments){
		if(err){
			console.log(err);
		} else{
			// console.log("movies list ",allentertainments)
		res.render("entertainment/sport",{entertainment:allentertainments})
	}
})
})
//create route
router.get("/new",middleware.isLoggedIn,(req, res)=>{
	res.render("entertainment/new")
})

//modify route
router.get("/:id",middleware.isLoggedIn,(req,res)=>{
	Entertainment.findById(req.params.id).populate("comments").populate({
        path: 'rating',
        populate: {
            path: 'author'
        }
    }).exec(function(err,foundentertainment){
		if(err){
			console.log(err)
		       }
		else{
			var a = [];
			for(var i=0;i<foundentertainment.rating.length;i++){
				a.push(foundentertainment.rating[i].rating);
			}
			var sum = a.reduce(function(a, b){
				return a + b;
			}, 0);
			var total=foundentertainment.rating.length;
			var avgrate=sum/total;
		res.render("entertainment/show",{entertainment:foundentertainment, currentUser: req.user,averagerate:avgrate})	
		    }       
	})
	
})
//edit route
router.get("/:id/edit",middleware.checkEntertainmentOwnership,(req,res)=>{
 Entertainment.findById(req.params.id,function(err,foundentertainment){
 res.render("entertainment/edit",{entertainment:foundentertainment})
	
    //otther also redirect
	//if not,redirect
  })
})

//update entertainment route
router.put("/:id",middleware.checkEntertainmentOwnership,upload.array('files'),async(req,res)=>{
try {
	const { id } = req.params;
	const entertain = await Entertainment.findById(id);
	if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await entertain.updateOne({ $pull: { files: { filename: { $in: req.body.deleteImages } } } })
    }
    const entertainment = await Entertainment.findByIdAndUpdate(id, req.body );
	const files = req.files.map(f => ({ url: f.path, filename: f.filename }));
    entertainment.files.push(...files);
    await entertainment.save();
    req.flash('success', 'Successfully updated entertainment!');
    res.redirect(`/entertainment/${entertainment._id}`);
	
} catch (error) {
		const { id } = req.params;
		const entertainment = await Entertainment.findById(id);
		req.flash('error', error.errors.files.message);
	  	res.redirect(`/entertainment/${entertainment._id}/edit`)
}

})


// DELETE entertainment ROUTE
router.delete("/:id",middleware.checkEntertainmentOwnership,async(req,res)=>{
	const { id } = req.params;
	const entertainment = await Entertainment.findByIdAndDelete(id);
	var ids = [];
	for (let filename of entertainment.files) {
        ids.push(filename.filename)
	}
	cloudinary.api.delete_resources(
		ids,
		{resource_type: 'image'},
		function(error, result) {
			console.log(result, error)
		},
	);
	cloudinary.api.delete_resources(
		ids,
		{resource_type: 'video'},
		function(error, result) {
			console.log(result, error)
		},
	);	
	req.flash("error", "successfully deleted an entertainment")
	res.redirect("/entertainment")
})

//fuzzy search
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

router.post('/:id/rating', async (req, res)=>{
	const entertainment = await Entertainment.findById(req.params.id).populate({
        path: 'rating',
        populate: {
            path: 'author'
        }
	}).populate('author');
	var ratedArray = [];
    for(var i=0;i<entertainment.rating.length;i++){
      ratedArray.push(String(entertainment.rating[i].author.id))
	}
    if (ratedArray.includes(String(req.user._id))) {
      req.flash(
        "error",
        "You've already reviewed this entertainment"
      );
      res.redirect(`/entertainment/${entertainment._id}`);
    }
	else {
		const rating = new Rating(req.body);
		rating.author = {id: req.user._id};
		entertainment.rating.push(rating);
		await rating.save();
		await entertainment.save();
		req.flash('success', 'Created new rating!');
		res.redirect(`/entertainment/${entertainment._id}`);
	}	
})

router.post("/:id/likes",(req, res)=>{
	Entertainment.findById(req.params.id, function (err, entertainment) {
        if (err) {
            console.log(err);
            return res.redirect("/entertainment/" + entertainment._id);
        }

        // check if req.user._id exists in foundCampground.likes
        var foundUserLike = entertainment.likes.some(function (like) {
            return like.equals(req.user._id);
        });

        if (foundUserLike) {
            // user already liked, removing like
            entertainment.likes.pull(req.user._id);
        } else {
            // adding the new user like
            entertainment.likes.push(req.user);
        }

        entertainment.save(function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/entertainment/" + entertainment._id);
            }
            return res.redirect("/entertainment/" + entertainment._id);
        });
    });
});

module.exports=router;