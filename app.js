const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const Sequelize = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const bcrypt = require('bcrypt');

//get the css files
app.use(express.static('public'));

//set ejs
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));

//db config
const sequelize = new Sequelize({
  database: process.env.BLOGAPP,
  username: process.env.POSTGRES_USER,
  host: 'localhost',
  dialect: 'postgres',
  storage: './session.postgres',
});

app.use(
  session({
    store: new SequelizeStore({
      db: sequelize,
      checkExpirationInterval: 15 * 60 * 1000,
      expiration: 24 * 60 * 60 * 1000,
    }),
    secret: 'dunno',
    saveUninitialized: true,
    resave: false,
  })
);

//defining the User model
const User = sequelize.define(
  'users',
  {
    username: {
      type: Sequelize.STRING,
      unique: true,
    },
    email: {
      type: Sequelize.STRING,
      unique: true,
    },
    password: {
      type: Sequelize.STRING,
      unique: true,
    },
  },

  {
    timestamps: false,
  }
);

//defining the post model
const Post = sequelize.define('posts', {
  title: {
    type: Sequelize.STRING,
  },
  body: {
    type: Sequelize.TEXT,
  },
  createdAt: Sequelize.DATEONLY,
  updatedAt: Sequelize.DATEONLY,
});

//defining the comment model
const Comment = sequelize.define('comments', {
  comment: {
    type: Sequelize.TEXT,
  },
  commentAuthor: {
    type: Sequelize.TEXT,
  },
  createdAt: Sequelize.DATEONLY,
  updatedAt: Sequelize.DATEONLY,
});

//defining the relationships between the models
User.hasMany(Post);
Post.belongsTo(User);
Post.hasMany(Comment);
Comment.belongsTo(Post);
User.hasMany(Comment);
Comment.belongsTo(User);

//login is the home (if logged out)
app.get('/', (req, res) => {
  const message = req.query.message;
  if (req.session.user) {
    res.redirect(`/blog/${req.session.user.username}`);
  } else {
    res.render('login', { message });
  }
});

//signup route
app.get('/signup', (req, res) => {
  const error = req.query.error;
  res.render('signup', { error });
});

//post request login
app.post('/login', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  //email and password is needed
  if (!email) {
    res.redirect(
      '/?message=' + encodeURIComponent('Please fill out your email address.')
    );
  }
  if (!password) {
    res.redirect(
      '/?message=' + encodeURIComponent('Please fill out your password.')
    );
  }
  //find the user with the email from the req
  User.findOne({
    where: {
      email: email,
    },
  })
    .then(user => {
      if (user) {
        bcrypt.compare(password, user.password).then(isValidPassword => {
          if (isValidPassword) {
            req.session.user = user;
            res.redirect(`/blog/${user.username}`);
          } else {
            //if the password is incorrect, send a message
            res.redirect(
              '/?message=' + encodeURIComponent('Invalid  password.')
            );
          }
        });
      } else {
        //if user does not exist, send a message
        res.redirect('/?message=' + encodeURIComponent('User does not exist'));
      }
    })
    .catch(error => {
      console.error(error);
    });
});

//post request signup
app.post('/signup', (req, res) => {
  //all fields are required
  if (!req.body.username || !req.body.email || !req.body.password) {
    res.redirect(
      '/signup?error=' + encodeURIComponent('All fields are required')
    );
  }
  //validates that passwords match
  if (req.body.password !== req.body.confirmPassword) {
    res.redirect('/signup?error=' + encodeURIComponent('Passwords must match'));
  }
  //find a user with that username
  User.findOne({
    where: {
      username: req.body.username,
    },
  })
    .then(user => {
      //if username is already taken, then send an error
      if (user) {
        return res.redirect(
          '/signup?error=' + encodeURIComponent('Username already taken')
        );
      }
    })
    .catch(err => {
      console.log(err);
    });

  const password = req.body.password;
  bcrypt
    .hash(password, 8)
    .then(hash => {
      return User.create({
        //populate the user table using an encrypted password
        username: req.body.username,
        email: req.body.email,
        password: hash,
      });
    })
    .then(user => {
      req.session.user = user;
      //and redirect the newly created user to his/her blog
      res.redirect(`/blog/${user.username}`);
    })
    .catch(err => {
      console.log(err);
    });
});

//render the create post form
app.get('/create-post', (req, res) => {
  const username = req.session.user.username;
  res.render('create_post', { username });
});

//create a new blog post
app.post('/create-post', (req, res) => {
  const username = req.session.user.username;
  const title = req.body.title;
  const postBody = req.body.newPostBody;

  User.findOne({
    where: {
      username: username,
    },
  })
    .then(user => {
      //populate post table
      return user.createPost({
        title: title,
        body: postBody,
      });
    })
    .then(post => {
      res.redirect(`/blog/${username}/${post.id}`);
    })
    .catch(err => {
      console.log(err);
    });
});

//get all blogposts from all users
app.get('/blog', (req, res) => {
  const user = req.session.user;
  Post.findAll({
    include: [
      {
        model: User,
      },
    ],
  }).then(post => {
    res.render('all_posts', { postData: post, user: user || {} });
  });
});

//render the blog from specific user
app.get('/blog/:username', (req, res) => {
  const user = req.session.user;
  const username = req.params.username;

  return Post.findAll({
    include: [
      {
        model: User,
        where: { username: username },
      },
    ],
  }).then(posts => {
    res.render('blog', {
      userInfo: user || {},
      posts,
      postAuthor: username,
    });
  });
});

//render specific post from each user
app.get('/blog/:username/:postId', (req, res) => {
  const user = req.session.user;
  const postId = req.params.postId;
  const username = req.params.username;
  //fist check if there are any comments
  Comment.findAll({
    where: {
      postId: postId,
    },
  })
    .then(comments => {
      //if the comments exist then find the post including the model table
      if (comments.length) {
        return Post.findOne({
          where: {
            id: postId,
          },
          include: [
            {
              model: User,
              where: { username: username },
            },
            {
              model: Comment,
            },
          ],
        });
      } else {
        //if there are no comments, then only find the post with that id and user
        return Post.findOne({
          where: {
            id: postId,
          },
          include: [
            {
              model: User,
              where: { username: username },
            },
          ],
        });
      }
    })
    .then(post => {
      res.render('blog_post', { post, user });
    });
});

//new comment for post
app.post('/new-comment', (req, res) => {
  const comment = req.body.comment;
  const userId = req.session.user.id;
  const username = req.session.user.username;
  //hidden inputs to create the redirect path
  const postId = req.body.postId;
  const postAuthor = req.body.postAuthor;

  return Comment.create({
    comment,
    commentAuthor: username,
    postId,
    userId,
  })
    .then(comment => {
      res.redirect(`/blog/${postAuthor}/${postId}`);
    })
    .catch(err => {
      console.log(err);
    });
});

//logout route
app.get('/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) {
      throw error;
    }
    res.redirect('/?message=' + encodeURIComponent('You are logged out.'));
  });
});

sequelize
  .sync()
  .then(() => {
    const server = app.listen(3000, () => {
      console.log('App listening on port: ' + server.address().port);
    });
  })
  .catch(error => console.log('This error occured', error));
