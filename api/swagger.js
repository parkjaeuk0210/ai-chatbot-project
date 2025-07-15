// Swagger UI setup for API documentation
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load OpenAPI specification
const openApiDocument = load(
  readFileSync(join(__dirname, '..', 'openapi.yaml'), 'utf8')
);

// Custom CSS for Swagger UI
const customCss = `
  .swagger-ui .topbar { display: none }
  .swagger-ui .info { margin-bottom: 50px }
  .swagger-ui .info .title { font-size: 36px; color: #3b82f6 }
  .swagger-ui .scheme-container { background: #f0f9ff; padding: 20px; border-radius: 8px }
  .swagger-ui .btn.authorize { background: #3b82f6; border: none }
  .swagger-ui .btn.authorize:hover { background: #2563eb }
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #3b82f6 }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #10b981 }
`;

// Swagger UI options
const swaggerOptions = {
  customCss,
  customSiteTitle: "FERA AI API Documentation",
  customfavIcon: "/icons/icon.svg",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      // Add timestamp to requests
      if (req.body) {
        req.body._timestamp = new Date().toISOString();
      }
      return req;
    },
    responseInterceptor: (res) => {
      // Log response time
      console.log(`API Response Time: ${res.duration}ms`);
      return res;
    },
  },
};

// Setup function for Express app
export function setupSwagger(app) {
  // Serve Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, swaggerOptions)
  );

  // Serve OpenAPI spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.json(openApiDocument);
  });

  // Serve OpenAPI spec as YAML
  app.get('/api-docs.yaml', (req, res) => {
    res.type('yaml').send(readFileSync(join(__dirname, '..', 'openapi.yaml'), 'utf8'));
  });

  console.log('Swagger UI available at: /api-docs');
}

// Validation middleware using OpenAPI spec
export function validateRequest(operationId) {
  return async (req, res, next) => {
    try {
      // Find operation in OpenAPI spec
      const operation = findOperation(openApiDocument, operationId);
      if (!operation) {
        return next();
      }

      // Validate request body
      if (operation.requestBody && req.body) {
        const schema = operation.requestBody.content['application/json'].schema;
        const errors = validateAgainstSchema(req.body, schema, openApiDocument);
        
        if (errors.length > 0) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: '입력 데이터가 올바르지 않습니다.',
              details: errors,
            },
          });
        }
      }

      // Validate query parameters
      if (operation.parameters) {
        const queryErrors = validateParameters(req.query, operation.parameters, 'query');
        const pathErrors = validateParameters(req.params, operation.parameters, 'path');
        const headerErrors = validateParameters(req.headers, operation.parameters, 'header');
        
        const allErrors = [...queryErrors, ...pathErrors, ...headerErrors];
        if (allErrors.length > 0) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: '요청 파라미터가 올바르지 않습니다.',
              details: allErrors,
            },
          });
        }
      }

      next();
    } catch (error) {
      console.error('OpenAPI validation error:', error);
      next();
    }
  };
}

// Helper functions
function findOperation(spec, operationId) {
  for (const path in spec.paths) {
    for (const method in spec.paths[path]) {
      const operation = spec.paths[path][method];
      if (operation.operationId === operationId) {
        return operation;
      }
    }
  }
  return null;
}

function validateAgainstSchema(data, schema, spec, errors = []) {
  if (schema.$ref) {
    const refPath = schema.$ref.split('/').slice(1);
    schema = refPath.reduce((acc, part) => acc[part], spec);
  }

  // Required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in data)) {
        errors.push({
          field,
          message: `${field} is required`,
        });
      }
    }
  }

  // Type validation
  if (schema.properties) {
    for (const field in data) {
      if (schema.properties[field]) {
        const fieldSchema = schema.properties[field];
        validateFieldType(data[field], fieldSchema, field, errors);
      }
    }
  }

  return errors;
}

function validateFieldType(value, schema, field, errors) {
  if (schema.type === 'string' && typeof value !== 'string') {
    errors.push({
      field,
      message: `${field} must be a string`,
    });
  } else if (schema.type === 'number' && typeof value !== 'number') {
    errors.push({
      field,
      message: `${field} must be a number`,
    });
  } else if (schema.type === 'array' && !Array.isArray(value)) {
    errors.push({
      field,
      message: `${field} must be an array`,
    });
  } else if (schema.type === 'object' && typeof value !== 'object') {
    errors.push({
      field,
      message: `${field} must be an object`,
    });
  }

  // Additional validations
  if (schema.minLength && value.length < schema.minLength) {
    errors.push({
      field,
      message: `${field} must be at least ${schema.minLength} characters`,
    });
  }
  if (schema.maxLength && value.length > schema.maxLength) {
    errors.push({
      field,
      message: `${field} must not exceed ${schema.maxLength} characters`,
    });
  }
  if (schema.minimum && value < schema.minimum) {
    errors.push({
      field,
      message: `${field} must be at least ${schema.minimum}`,
    });
  }
  if (schema.maximum && value > schema.maximum) {
    errors.push({
      field,
      message: `${field} must not exceed ${schema.maximum}`,
    });
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({
      field,
      message: `${field} must be one of: ${schema.enum.join(', ')}`,
    });
  }
}

function validateParameters(data, parameters, location) {
  const errors = [];
  
  for (const param of parameters.filter(p => p.in === location)) {
    if (param.required && !(param.name in data)) {
      errors.push({
        field: param.name,
        message: `${param.name} is required in ${location}`,
      });
    }
    
    if (param.name in data) {
      const value = data[param.name];
      validateFieldType(value, param.schema, param.name, errors);
    }
  }
  
  return errors;
}