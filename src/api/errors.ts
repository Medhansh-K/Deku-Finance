/**
 * Deku Finance — Centralized API Error Handling
 */

export class ApiError extends Error {
  public status: number;
  public details?: any;

  constructor(message: string, status = 500, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export class NetworkError extends Error {
  constructor(message = "Unable to connect to Deku Finance backend service. Please check your network or server status.") {
    super(message);
    this.name = "NetworkError";
  }
}

export class ValidationError extends Error {
  public fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>, message = "Financial validation failed.") {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}
