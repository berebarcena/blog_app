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
  },
  email: {
    type: Sequelize.STRING,
  },
  password: {
    type: Sequelize.STRING,
  },
});

app.get('/', (req, res) => {
  res.render('login', { message: req.query.message });
});

//post request
app.post('/login', (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;

  //populating the user table with the inputs from the form
  User.create({
    name: name,
    email: email,
    password: password,
  })
    .then(user => {
      req.session.user = user;
      res.redirect('/profile');
    })
    .catch(err => {
      console.log(err);
    });
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

sequelize.sync({ force: true }).then(function() {
  var server = app.listen(3000, function() {
    console.log('App listening on port: ' + server.address().port);
  });
});
