export interface UserModel {
  userId: number;
  username: string;
}

export type CreateUserDto = Omit<UserModel, 'updatedAt' | 'createdAt'>;
