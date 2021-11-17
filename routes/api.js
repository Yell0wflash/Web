const express = require('express');
const bcrypt = require("bcrypt");
const randtoken = require("rand-token");
const router = express.Router();
const db = require('../modules/db');
const mail = require('../modules/mail');

const saltRounds = 10;

router.get('/getproducts', (req, res) => {
    const conn = db.connect();
    conn.execute('SELECT * FROM `products`', [], function (err, results) {
        res.json(results);
    });
})

router.get('/getproduct', (req, res) => {
    const conn = db.connect();
    conn.execute('SELECT * FROM `products` WHERE `ID` = ?', [req.query.id], function (err, results) {
        res.json(results);
    });
})

router.post('/register', async (req, res) => {
    if (!req.body.email || !req.body.password || !req.body.first_name || !req.body.last_name) {
        res.status(400);
        res.json({
            'message': 'Bad Request'
        })
    } else {
        const conn = db.connect();
        conn.query("SELECT * FROM users WHERE email = ?", [req.body.email], async function (error, response, fields) {
            if (error) {
                res.status(400);
                res.json({
                    'message': 'Bad Request'
                })
            } else {
                if (response.length > 0) {
                    res.status(400);
                    res.json({
                        'message': 'Bad Request'
                    })
                } else {
                    const encryptedPassword = await bcrypt.hash(req.body.password, saltRounds);
                    var users = {
                        first_name: req.body.first_name,
                        last_name: req.body.last_name,
                        email: req.body.email,
                        password: encryptedPassword,
                        session: [],
                    };
                    conn.query("INSERT INTO users SET ?", users, function (error, response, fields) {
                        if (error) {
                            res.status(400);
                            res.json({
                                'message': 'Bad Request'
                            })
                        } else {
                            var email = req.body.email;
                            conn.query('SELECT * FROM users WHERE email ="' + email + '"', function (err, result) {
                                if (err) {
                                    res.status(400);
                                    res.json({
                                        'message': 'Bad Request'
                                    })
                                }
                                if (result.length > 0) {
                                    var token = randtoken.generate(20);
                                    if (result[0].verify == 0) {
                                        var sent = mail.send(email, token);
                                        if (sent != "0") {
                                            var data = {
                                                token: token,
                                            };
                                            conn.query('UPDATE users SET ? WHERE email ="' + email + '"', data, function (err, result) {
                                                if (err) {
                                                    res.status(400);
                                                    res.json({
                                                        'message': 'Bad Request'
                                                    })
                                                }
                                            });
                                            res.status(200);
                                            res.json({
                                                'message': 'Register Verification Sent ~'
                                            })
                                        } else {
                                            res.status(400);
                                            res.json({
                                                'message': 'Bad Request'
                                            })
                                        }
                                    }
                                } else {
                                    res.status(400);
                                    res.json({
                                        'message': 'Bad Request'
                                    })
                                }
                            });
                        }
                    });
                }
            }
        });
    }
})

router.post('/login', async (req, res) => {
    if (!req.body.email || !req.body.password) {
        res.status(400);
        res.json({
            'message': 'Bad Request'
        })
    } else {
        const conn = db.connect();
        conn.query(
            "SELECT * FROM users WHERE email = ?",
            [req.body.email],
            async function (error, response, fields) {
                const passCheck = await bcrypt.compare(req.body.password, response[0].password);
                if (error) {
                    res.status(400);
                    res.json({
                        'message': 'Bad Request'
                    })
                } else {
                    if (response.length > 0) {
                        if (passCheck) {
                            if (response[0].verify == 0) {
                                res.status(204);
                                res.json({
                                    'message': 'Sorry You havent verified your email'
                                })
                            } else {
                                let token = randtoken.generate(256);
                                let session = JSON.parse(response[0].session);
                                session.push({
                                    user_agent: req.body.ua || req.headers['user-agent'],
                                    ip: req.body.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                                    session: token,
                                })
                                conn.query('UPDATE users SET ? WHERE email ="' + req.body.email + '"', {session: JSON.stringify(session)}, function (err, result) {
                                    if (err) {
                                        res.status(400);
                                        res.json({
                                            'message': 'Bad Request'
                                        })
                                    } else {
                                        res.status(200);
                                        res.json({
                                            'id': response[0].id,
                                            'first_name': response[0].first_name,
                                            'last_name': response[0].last_name,
                                            'email': response[0].email,
                                            'verify': (response[0].verify == 1) ? true : false,
                                            'session_token': token,
                                        })
                                    }
                                });
                            }
                        } else {
                            res.status(401);
                            res.json({
                                'message': 'Unauthorized'
                            })
                        }
                    } else {
                        res.status(400);
                        res.json({
                            'message': 'Bad Request'
                        })
                    }
                }
            }
        );
    }
})

module.exports = router;