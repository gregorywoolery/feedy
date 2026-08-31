export interface ApiFieldErrors {
  [field: string]: string[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: ApiFieldErrors;
  };
}
