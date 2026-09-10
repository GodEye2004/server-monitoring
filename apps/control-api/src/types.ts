export interface User {
  id: number;
  username: string;
  password: string;
  created_at: string;
}

export interface JwtPayload {
  id: number;
  username: string;
}