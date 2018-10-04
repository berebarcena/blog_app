const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const Sequelize = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

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
      checkExpirationInterval: 15 * 60 * 1000, // The interval at which to cleanup expired sessions in milliseconds.
      expiration: 24 * 60 * 60 * 1000, // The maximum age (in milliseconds) of a valid session.
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

//defining the user model
const Comment = sequelize.define('comments', {
  comment: {
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

//login is the home
app.get('/', (req, res) => {
  res.render('login', { message: req.query.message });
});

//signup route
app.get('/signup', (req, res) => {
  const error = req.query.error;
  const errorMsg =
    error === 'no-empty-fields' ? 'Sorry! but all the fields are required' : '';
  res.render('signup', { error: errorMsg });
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
      if (user && password === user.password) {
        req.session.user = user;
        res.redirect(`/blog/${user.username}`);
      } else {
        //if the password or email is incorrect, send a message
        res.redirect(
          '/?message=' + encodeURIComponent('Invalid email or password.')
        );
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
    res.redirect('/signup?error=no-empty-fields');
  } else {
    //populate the user table
    User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
    })
      .then(user => {
        req.session.user = user;
        res.redirect(`/blog/:${user.username}`);
      })
      .catch(err => {
        console.log(err);
      });
  }
});

app.get('/create-post', (req, res) => {
  res.render('create_post');
});

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
      return user.createPost({
        title: title,
        body: postBody,
      });
    })
    .then(post => {
      console.log(post);
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
    res.render('all_posts', { postData: post, user });
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
    let postTitle = '';
    let postBody = '';
    let postDate = '';
    let postAuthor = '';
    // console.log(posts);
    // console.log(`this is the user from the session------${user.username}`);
    posts.forEach(p => {
      postTitle = p.title;
      postBody = p.body;
      postDate = p.createdAt;
      postAuthor = p.user.username;
      console.log(typeof p);
    });
    console.log(typeof posts);
    res.render('blog', {
      userInfo: user,
      posts,
      postTitle,
      postBody,
      postDate,
      postAuthor,
    });
  });
});

app.get('/blog/:username/:postId', (req, res) => {
  const user = req.session.user;
  const postId = req.params.postId;
  const username = req.params.username;

  Post.findOne({
    where: {
      id: postId,
    },
    include: [
      {
        model: User,
        where: { username: username },
      },
    ],
  }).then(post => {
    res.render('blog_post', { post });
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
