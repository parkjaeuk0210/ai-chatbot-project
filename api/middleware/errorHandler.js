// Standardized error handling middleware

export class ApiError extends Error {
    constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'ApiError';
    }
}

// Standard error codes
export const ErrorCodes = {
    // Client errors (4xx)
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
    PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    
    // Server errors (5xx)
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
    AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
    CONFIG_ERROR: 'CONFIG_ERROR',
};

// Standard error messages in Korean
export const ErrorMessages = {
    [ErrorCodes.BAD_REQUEST]: '잘못된 요청입니다.',
    [ErrorCodes.UNAUTHORIZED]: '인증이 필요합니다.',
    [ErrorCodes.FORBIDDEN]: '접근 권한이 없습니다.',
    [ErrorCodes.NOT_FOUND]: '요청한 리소스를 찾을 수 없습니다.',
    [ErrorCodes.METHOD_NOT_ALLOWED]: '허용되지 않은 메서드입니다.',
    [ErrorCodes.PAYLOAD_TOO_LARGE]: '요청 크기가 너무 큽니다.',
    [ErrorCodes.RATE_LIMIT_EXCEEDED]: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',
    [ErrorCodes.VALIDATION_ERROR]: '입력 데이터가 올바르지 않습니다.',
    [ErrorCodes.INTERNAL_ERROR]: '서버 내부 오류가 발생했습니다.',
    [ErrorCodes.SERVICE_UNAVAILABLE]: '일시적으로 서비스를 이용할 수 없습니다.',
    [ErrorCodes.GATEWAY_TIMEOUT]: '요청 처리 시간이 초과되었습니다.',
    [ErrorCodes.AI_SERVICE_ERROR]: 'AI 서비스에 일시적인 문제가 발생했습니다.',
    [ErrorCodes.CONFIG_ERROR]: '서버 구성 오류가 발생했습니다.',
};

// Create standardized error response
export function createErrorResponse(error, includeDetails = false) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Default values
    let status = 500;
    let code = ErrorCodes.INTERNAL_ERROR;
    let message = ErrorMessages[ErrorCodes.INTERNAL_ERROR];
    let details = null;
    
    // Handle ApiError
    if (error instanceof ApiError) {
        status = error.status;
        code = error.code;
        message = error.message || ErrorMessages[code] || message;
        details = error.details;
    }
    // Handle standard errors
    else if (error instanceof Error) {
        // Check for specific error types
        if (error.name === 'ValidationError') {
            status = 400;
            code = ErrorCodes.VALIDATION_ERROR;
            message = ErrorMessages[code];
            details = !isProduction ? error.message : null;
        } else if (error.name === 'AbortError') {
            status = 504;
            code = ErrorCodes.GATEWAY_TIMEOUT;
            message = ErrorMessages[code];
        } else if (error.message.includes('API key')) {
            status = 500;
            code = ErrorCodes.CONFIG_ERROR;
            message = ErrorMessages[code];
        }
    }
    
    // Build response
    const response = {
        error: {
            code,
            message,
            timestamp: new Date().toISOString(),
        }
    };
    
    // Add details if requested and available
    if (includeDetails && details && !isProduction) {
        response.error.details = details;
    }
    
    // Add stack trace in development
    if (!isProduction && error instanceof Error && error.stack) {
        response.error.stack = error.stack.split('\n');
    }
    
    return { status, response };
}

// Error handler middleware
export async function errorHandler(error, request, response) {
    // Log error
    console.error(`[${new Date().toISOString()}] Error:`, {
        method: request.method,
        url: request.url,
        error: error.message,
        stack: error.stack,
    });
    
    // Create standardized response
    const { status, response: errorResponse } = createErrorResponse(
        error,
        process.env.NODE_ENV !== 'production'
    );
    
    // Send response
    response.status(status).json(errorResponse);
}

// Async error wrapper
export function asyncHandler(fn) {
    return async (request, response, next) => {
        try {
            await fn(request, response, next);
        } catch (error) {
            errorHandler(error, request, response);
        }
    };
}

// Validate and throw standardized errors
export function validateOrThrow(condition, message, code = ErrorCodes.VALIDATION_ERROR, status = 400) {
    if (!condition) {
        throw new ApiError(message, status, code);
    }
}

// Create specific error functions
export const createBadRequestError = (message, details) => 
    new ApiError(message || ErrorMessages[ErrorCodes.BAD_REQUEST], 400, ErrorCodes.BAD_REQUEST, details);

export const createUnauthorizedError = (message) => 
    new ApiError(message || ErrorMessages[ErrorCodes.UNAUTHORIZED], 401, ErrorCodes.UNAUTHORIZED);

export const createForbiddenError = (message) => 
    new ApiError(message || ErrorMessages[ErrorCodes.FORBIDDEN], 403, ErrorCodes.FORBIDDEN);

export const createNotFoundError = (message) => 
    new ApiError(message || ErrorMessages[ErrorCodes.NOT_FOUND], 404, ErrorCodes.NOT_FOUND);

export const createRateLimitError = (retryAfter) => 
    new ApiError(ErrorMessages[ErrorCodes.RATE_LIMIT_EXCEEDED], 429, ErrorCodes.RATE_LIMIT_EXCEEDED, { retryAfter });

export const createValidationError = (errors) => 
    new ApiError(ErrorMessages[ErrorCodes.VALIDATION_ERROR], 400, ErrorCodes.VALIDATION_ERROR, errors);

export const createInternalError = (message) => 
    new ApiError(message || ErrorMessages[ErrorCodes.INTERNAL_ERROR], 500, ErrorCodes.INTERNAL_ERROR);

export const createServiceError = (message) => 
    new ApiError(message || ErrorMessages[ErrorCodes.AI_SERVICE_ERROR], 503, ErrorCodes.AI_SERVICE_ERROR);