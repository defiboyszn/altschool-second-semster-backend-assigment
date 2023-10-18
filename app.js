const express = require('express');
const { engine } = require('express-handlebars');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
const { config } = require("dotenv");
const { User, Task } = require("./models");
const app = express();

config();
// Serve static assets from the "public" directory
app.use(express.static('public'));
// Set up Handlebars as the view engine
app.engine('handlebars', engine({
    runtimeOptions: {
        allowedProtoProperties: true,
        allowProtoMethodsByDefault: true,
        allowProtoPropertiesByDefault: true
    }
}));
app.set('view engine', 'handlebars');
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// utilites
const respond = (res, status = 200, message, data = null) => {
    const successCodes = [200, 201,]

    return res.status(status).send({
        status: successCodes.includes(status) ? 'success' : 'error',
        message,
        data,
    })

}





// Middleware

const verifyAuthToken = async (req, res, next) => {
    try {
        const token = req.cookies?.authToken;

        // check if it exists
        if (!token) return respond(res, 401, "Pls Authenticate");

        // check if it's valid
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (!decoded) return respond(res, 401, "Pls Authenticate");

        if (decoded?.type !== "auth") return respond(res, 401, "Pls provide a valid token...");

        // check if user exists
        const user = await User.findOne({
            username: decoded.username,
        });
        if (!user) return respond(res, 404, "Sorry but user is not found!");

        req.user = user;
        req.token = token;

        next();
    } catch (e) {
        // if something went wrong
        respond(res, 401, "Pls Authenticate");
    }
};













app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

// Utilities
function removeSpacesFromUsername(username) {
    // Use a regular expression to match and remove spaces
    const cleanedUsername = username.replace(/\s/g, '');
    return cleanedUsername;
}

// POST routes
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (user && user.password === password) {
            const token = jwt.sign(
                { userId: user.id, username: user.username, type: "auth" },
                process.env.SECRET_KEY,
                { expiresIn: "1h" }
            );

            // Set a cookie with the token
            res.cookie('authToken', token, {
                httpOnly: true, // Prevent JavaScript access to the cookie
                maxAge: 3600000, // Set the cookie to expire in 1 hour (1h * 60min * 60sec * 1000ms)
            });

            // Redirect to "/task" upon successful login
            return res.redirect('/');
        }

        res.status(401).json({ message: "Invalid credentials" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong, please try again later." });
    }
});


app.post('/register', async (req, res) => {
    try {
        const { username, password, confirmPassword } = req.body;
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(400).json({ message: "Username already exists" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        const user = new User({
            username: removeSpacesFromUsername(username),
            password
        });

        await user.save();

        return res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong, please try again later." });
    }
});

app.get('/', async (req, res) => {
    // Get the token from the cookie
    const token = req.cookies?.authToken;


    // Check if the token exists
    if (!token) {
        // res.status(401).send("Please Authenticate");
        return res.redirect('/login');
    }

    try {
        // Verify the token and retrieve user information
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        const user = await User.findOne({
            username: decoded.username,
        });

        if (!user) {
            return res.status(401).send("Please Authenticate");
        }

        // If user is authenticated, fetch tasks and render the page
        const tasks = await Task.find({ user: user });
        res.render('tasks', { layout: 'main', pageTitle: 'Task List', tasks: tasks, username: user?.username });
    } catch (error) {
        console.error(error);
        return res.status(401).send("Please Authenticate!!!");
    }

});
app.post('/tasks', verifyAuthToken, async (req, res) => {
    try {
        const newTask = new Task({ ...req.body, done: false, user: req.user });

        await newTask.save();
        // Redirect to "/task" upon successful login
        return res.redirect('/');
        // res.status(200).json({ message: "Added successful", data: newTask.toJSON() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong, please try again later." });
    }
});
app.put('/tasks/:taskId', verifyAuthToken, async (req, res) => {
    const taskId = req.params.taskId;

    try {
        const task = await Task.findOne({ _id: taskId, user: req.user });

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }


        if (task.done) {
            task.done = false;
            await task.save();
        } else {
            task.done = true;
            await task.save();
        }
        // res.status(200).json({ message: 'Task updated successfully', data: task.toJSON() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Something went wrong, please try again later.' });
    }
});
app.delete('/tasks/:taskId', verifyAuthToken, async (req, res) => {
    const taskId = req.params.taskId;

    try {
        const task = await Task.findOne({ _id: taskId, user: req.user });

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Delete the task from the database (optional)
        await Task.findOneAndDelete({ _id: taskId, user: req.user });
        return res.redirect('/login');

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Something went wrong, please try again later.' });
    }
});



// Handle errors globally.
app.use((err, req, res, next) => {
    // Log and handle errors.
    console.error(err);
    res.status(500).send('Something went wrong');
});

// app.listen(3000, () => {
//     console.log('Server is running on port 3000');
// });
module.exports = app;