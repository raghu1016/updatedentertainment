var express = require("express");
var router  = express.Router();
var passport = require("passport");
var User = require("../models/user");
var Entertainment = require("../models/entertainment");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");
var Notification = require("../models/notification");
var middleware = require("../middleware")


//home route
router.get("/",(req, res)=>{
	res.render("home")
})

//========================================//
// AUTH ROUTES
//========================================//


// register/sign uo form
router.get("/register",function(req, res){
res.render("users/register")	
})

router.post('/register', function(req, res, next) {
var newUser = new User({
    firstname:req.body.firstname,
    lastname:req.body.lastname,
    username:req.body.username,
    email:req.body.email
                      })
    var secretcode = process.env.SECRET
    if(req.body.adminCode === secretcode) {
        newUser.isAdmin = true;
      }
User.register(newUser,req.body.password,function (err,user) {
    if (err) {
        console.log(err);
        req.flash("error", "err" + err.message)
        return res.render("users/register")
    }
    else {
      req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
      res.redirect('/login');
      async.waterfall([
        (done)=>{
            crypto.randomBytes(20, (err, buf)=>{
                var token = buf.toString('hex');
                done(err, token);
            })
        },
        (token, done)=>{
            User.findOne({email: req.body.email}, (err, user)=>{
                if(!user){
                    req.flash('error', 'Email already exists');
                    return res.redirect('/register');
                }
                user.verifyEmail = token;
                user.active = false;
                user.save(function(err) {
                    done(err, token, user);
                });
            });
        },
        (token, user, done)=>{
            var smtpTransport = nodemailer.createTransport({
                service: 'Gmail', 
                auth: {
                  user: process.env.GMAILID,
                  pass: process.env.GMAILPW
                }
            })
            const msg = {
                to: req.body.email,
                from: process.env.GMAILID, // Use the email address or domain you verified above
                subject: 'Entertainment email address verfication',
                html: `<p>You are receiving this because to verify your account.</p><p>Please click on the following button to activate:</p><div style="text-align: center"><a href=${'http://' + req.headers.host + '/register/' + token} style="background-color: #007bff;border: none;color: white;padding: 10px 20px;text-align: center;text-decoration: none;display: inline-block;font-size: 16px;cursor: pointer;">Activate</a></div>`
              };
              smtpTransport.sendMail(msg, (err)=>{
                done(err, 'done');
            })
        }
    ])
    }
});
});


router.get('/register/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ verifyEmail: req.params.token }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
            user.verifyEmail = null;
            user.active = true;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: process.env.GMAILID,
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: process.env.GMAILID,
        subject: 'Your account has been verified',
        text: 'Hello,\n\n' +
          'This is a confirmation that your account has been verified' + user.email + 'now enjoy begins.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Registered successfully.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/');
  });
});



//show login form
router.get("/login",function (req,res){
	res.render("users/login")
})

// handle longin logic
router.post("/login", passport.authenticate("local", 
{
    successRedirect: "/entertainment",
    failureRedirect: "/login",
    failureFlash: true
}), function (req, res) {
})

// logout
router.get("/logout", function (req, res) {
    req.logout();
    req.flash("success","logged you out")
    res.redirect("/");
})

//forgot password
router.get('/forgot', function(req, res) {
  res.render('users/forgot');
});

router.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: process.env.GMAILID,
          pass: process.env.GMAILPW
        }
    })
      var mailOptions = {
        to: user.email,
        from: process.env.GMAILID,
        subject: 'Entertainment Password Reset',
        html: `<p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p><p>Please click on the following button to reset the password:</p><div style="text-align: center"><a href=${'http://' + req.headers.host + '/reset/' + token} style="background-color: #007bff;border: none;color: white;padding: 10px 20px;text-align: center;text-decoration: none;display: inline-block;font-size: 16px;cursor: pointer;">Reset password</a></div>
        <p>If you did not request this, please ignore this email and your password will remain unchanged</p>`
        

      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err)
    // console.log(err)       
    return next(err);
    res.redirect('/forgot');


  });
});

//password reset token get

router.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('users/reset', {token: req.params.token});
  });
});

//password reset token post

router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          })
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: process.env.GMAILID,
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from:process.env.GMAILID,
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/entertainment');
  });
});

router.get('/users/:id',middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.params.id).populate('followers').exec()
      try {
        let entertainment = await Entertainment.find().where("author.id").equals(user._id).exec();
        res.render("users/profile",{user,entertainment})
       } catch(err) {
         req.flash("error",err.message);
        res.redirect("/")
       }
      } catch(err) {
    req.flash('error', err.message);
    return res.redirect('back');
  }
});


//follow user
router.get('/follow/:id', middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.params.id);
    user.followers.push(req.user._id);
    user.save();
    req.flash('success', 'Successfully followed ' + user.username + '!');
    res.redirect('/users/' + req.params.id);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

// view all notifications
router.get('/notifications', middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.user._id).populate({
      path: 'notifications',
      options: { sort: { "_id": -1 } }
    }).exec();
    let allNotifications = user.notifications;
    res.render('notifications/index', { allNotifications });
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

// handle notification
router.get('/notifications/:id', middleware.isLoggedIn, async function(req, res) {
  try {
    let notification = await Notification.findById(req.params.id);
    notification.isRead = true;
    notification.save();
    res.redirect(`/entertainment/${notification.entertainmentId}`);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

router.get('/users',middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.user._id).populate('followers').exec()
      try {
        let entertainment = await Entertainment.find().where("author.id").equals(user._id).exec();
        res.render("users/personalprofile",{user,entertainment})
       } catch(err) {
         req.flash("error",err.message);
        res.redirect("/")
       }
      } catch(err) {
    req.flash('error', err.message);
    return res.redirect('back');
  }
});

module.exports=router;