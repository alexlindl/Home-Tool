/**
 * Request validation middleware
 * Provides common validation utilities for API endpoints
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Validate that request body is valid JSON and not empty
 */
export const validateJsonBody = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    if (!req.body || Object.keys(req.body).length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Request body is required',
      });
      return;
    }
  }
  next();
};

/**
 * Validate required fields in request body
 * @param fields Array of required field names
 */
export const validateRequiredFields = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingFields = fields.filter(field => !(field in req.body));
    
    if (missingFields.length > 0) {
      res.status(400).json({
        status: 'error',
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
      return;
    }
    
    next();
  };
};

/**
 * Validate UUID format
 * @param paramName Name of the parameter to validate (e.g., 'id', 'userId')
 */
export const validateUUID = (paramName: string = 'id') => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName] || req.body[paramName];
    
    if (value && !uuidRegex.test(value)) {
      res.status(400).json({
        status: 'error',
        message: `Invalid ${paramName} format. Must be a valid UUID`,
      });
      return;
    }
    
    next();
  };
};

/**
 * Validate that a value is one of the allowed options
 * @param fieldName Name of the field to validate
 * @param allowedValues Array of allowed values
 */
export const validateEnum = (fieldName: string, allowedValues: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.body[fieldName];
    
    if (value && !allowedValues.includes(value)) {
      res.status(400).json({
        status: 'error',
        message: `Invalid ${fieldName}. Must be one of: ${allowedValues.join(', ')}`,
      });
      return;
    }
    
    next();
  };
};

/**
 * Sanitize string input (trim whitespace, prevent XSS)
 */
export const sanitizeStrings = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Trim whitespace
        req.body[key] = req.body[key].trim();
        
        // Basic XSS prevention (remove script tags)
        req.body[key] = req.body[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
    });
  }
  next();
};
