/**
 * Security middleware for API endpoints
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// Rate limiting configurations
const createRateLimiter = (options) => {
    return rateLimit({
        windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
        max: options.max || 100, // limit each IP to 100 requests per windowMs
        message: options.message || 'Too many requests from this IP, please try again later.',
        standardHeaders: true, // Return rate limit info in headers
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too Many Requests',
                message: options.message || 'Too many requests from this IP, please try again later.',
                retryAfter: Math.ceil(options.windowMs / 1000)
            });
        }
    });
};

// Different rate limiters for different endpoints
const rateLimiters = {
    chat: createRateLimiter({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 50,
        message: 'Too many chat messages, please slow down.'
    }),
    image: createRateLimiter({
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 10,
        message: 'Too many image generation requests, please try again later.'
    }),
    general: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100
    })
};

// Helmet configuration for security headers
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.tailwindcss.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://fera-ai.vercel.app", "wss:", "https:"],
            workerSrc: ["'self'", "blob:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false, // Allow images from other origins
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
};

// Input validation middleware
const validateInput = (req, res, next) => {
    // Sanitize request body
    if (req.body) {
        // Remove any MongoDB operators
        mongoSanitize.sanitize(req.body);
        
        // Additional validation for specific fields
        if (req.body.message && typeof req.body.message === 'string') {
            // Limit message length
            if (req.body.message.length > 5000) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Message too long (max 5000 characters)'
                });
            }
        }
        
        if (req.body.url && typeof req.body.url === 'string') {
            // Validate URL
            try {
                const url = new URL(req.body.url);
                if (!['http:', 'https:'].includes(url.protocol)) {
                    throw new Error('Invalid protocol');
                }
            } catch (e) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Invalid URL provided'
                });
            }
        }
    }
    
    next();
};

// Request size limiting
const requestSizeLimit = require('express').json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        // Additional verification if needed
        req.rawBody = buf.toString('utf8');
    }
});

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:5500',
            'http://localhost:5501',
            'http://localhost:5502',
            'http://127.0.0.1:5500',
            'http://127.0.0.1:5501',
            'http://127.0.0.1:5502',
            'https://fera-ai.vercel.app',
            'https://fera.onlinestudio.site'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

module.exports = {
    helmet: () => helmet(helmetConfig),
    rateLimiters,
    validateInput,
    requestSizeLimit,
    corsOptions,
    mongoSanitize: mongoSanitize()
};