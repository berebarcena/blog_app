const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const Sequelize = require('sequelize');

app.use(bodyParser.urlencoded({ extended: false }));

app.set('view engine', 'ejs');

//get the css files
app.use(express.static('public'));

//db config
const sequelize = new Sequelize({
  database: process.env.BLOGAPP,
  username: process.env.POSTGRES_USER,
  host: 'localhost',
  dialect: 'postgres',
  define: {
    timestamps: false, // true by default
  },
});

app.use(
  session({
    secret: 'navi es bebe',
    saveUninitialized: true,
    resave: false,
  })
);

//defining the Models
const User = sequelize.define('users', {
  name: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false,
  },
  email: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false,
  },
});

app.get('/', (req, res) => {
  res.render('login', { message: req.query.message });
});
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
    .catch(function(error) {
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
  res.render('profile', { userInfo: req.session.user });
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
