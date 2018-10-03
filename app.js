const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const Sequelize = require('sequelize');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

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

//get the css files
app.use(express.static('public'));

//defining the User model
const User = sequelize.define(
  'users',
  {
    name: {
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

const Comment = sequelize.define('comments', {
  comment: {
    type: Sequelize.TEXT,
  },
  createdAt: Sequelize.DATEONLY,
  updatedAt: Sequelize.DATEONLY,
});
//defining the relationships
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
        res.redirect('/profile');
      } else {
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
  if (!req.body.name || !req.body.email || !req.body.password) {
    res.redirect('/signup?error=no-empty-fields');
  } else {
    User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
    })
      .then(user => {
        req.session.user = user;
        res.redirect('/profile');
      })
      .catch(err => {
        console.log(err);
      });
  }
});
//render the profile
app.get('/profile', (req, res) => {
  const user = req.session.user;
  return Post.findAll({
    include: [
      {
        model: User,
        where: { name: user.name },
      },
    ],
  }).then(posts => {
    res.render('profile', { userInfo: user, posts });
  });
});

app.get('/new-post', (req, res) => {
  res.render('new_post');
});

app.post('/new-post', (req, res) => {
  const user = req.session.user.name;
  const title = req.body.title;
  const postBody = req.body.newPostBody;

  User.findOne({
    where: {
      name: user,
    },
  })
    .then(user => {
      return user.createPost({
        title: title,
        body: postBody,
      });
    })
    .then(post => {
      //console.log(post);
      res.redirect(`/all-posts/${post.id}`);
    })
    .catch(err => {
      console.log(err);
    });
});

app.get('/all-posts', (req, res) => {
  Post.findAll({
    include: [
      {
        model: User,
      },
    ],
  }).then(post => {
    res.render('all_posts', { postData: post });
  });
});

app.get('/all-posts/:postId', (req, res) => {
  const postId = req.params.postId;
  Post.findOne({
    where: {
      id: postId,
    },
    include: [
      {
        model: User,
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
