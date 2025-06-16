package models

import (
	"time"
)

// User represents the user entity for all database libraries
type User struct {
	ID        int       `json:"id" db:"id" gorm:"primaryKey"`
	Name      string    `json:"name" db:"name" gorm:"type:varchar(100);not null"`
	Email     string    `json:"email" db:"email" gorm:"type:varchar(255);uniqueIndex;not null"`
	Age       int       `json:"age" db:"age" gorm:"check:age >= 0 AND age <= 150"`
	CreatedAt time.Time `json:"created_at" db:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at" gorm:"autoUpdateTime"`
	IsActive  bool      `json:"is_active" db:"is_active" gorm:"default:true"`
}

// CreateUserRequest represents the request for creating a user
type CreateUserRequest struct {
	Name  string `json:"name" validate:"required,min=1,max=100"`
	Email string `json:"email" validate:"required,email"`
	Age   int    `json:"age" validate:"min=0,max=150"`
}

// UpdateUserRequest represents the request for updating a user
type UpdateUserRequest struct {
	Name     *string `json:"name,omitempty" validate:"omitempty,min=1,max=100"`
	Email    *string `json:"email,omitempty" validate:"omitempty,email"`
	Age      *int    `json:"age,omitempty" validate:"omitempty,min=0,max=150"`
	IsActive *bool   `json:"is_active,omitempty"`
}

// TableName returns the table name for GORM
func (User) TableName() string {
	return "users"
}