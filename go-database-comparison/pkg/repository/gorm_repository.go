package repository

import (
	"context"
	"fmt"
	"time"

	"go-database-comparison/pkg/models"
	"gorm.io/gorm"
)

// GORMRepository implements repository pattern using GORM ORM
type GORMRepository struct {
	db *gorm.DB
}

// NewGORMRepository creates a new GORM repository instance
func NewGORMRepository(db *gorm.DB) *GORMRepository {
	return &GORMRepository{db: db}
}

// CreateUser creates a new user using GORM ORM
func (r *GORMRepository) CreateUser(ctx context.Context, req *models.CreateUserRequest) (*models.User, error) {
	user := &models.User{
		Name:     req.Name,
		Email:    req.Email,
		Age:      req.Age,
		IsActive: true,
	}

	// GORM automatically handles created_at and updated_at
	if err := r.db.WithContext(ctx).Create(user).Error; err != nil {
		return nil, fmt.Errorf("GORM create user failed: %w", err)
	}

	return user, nil
}

// GetUserByID retrieves a user by ID using GORM
func (r *GORMRepository) GetUserByID(ctx context.Context, id int) (*models.User, error) {
	var user models.User
	
	// Equivalent SQL: SELECT * FROM users WHERE id = ? AND is_active = true
	err := r.db.WithContext(ctx).Where("id = ? AND is_active = ?", id, true).First(&user).Error
	
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user with ID %d not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("GORM get user failed: %w", err)
	}

	return &user, nil
}

// GetAllUsers retrieves all active users using GORM with pagination
func (r *GORMRepository) GetAllUsers(ctx context.Context, limit, offset int) ([]*models.User, error) {
	var users []models.User
	
	// Equivalent SQL: SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT ? OFFSET ?
	err := r.db.WithContext(ctx).
		Where("is_active = ?", true).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&users).Error
	
	if err != nil {
		return nil, fmt.Errorf("GORM get all users failed: %w", err)
	}

	// Convert to pointer slice for consistent interface
	result := make([]*models.User, len(users))
	for i := range users {
		result[i] = &users[i]
	}

	return result, nil
}

// UpdateUser updates a user using GORM with selective updates
func (r *GORMRepository) UpdateUser(ctx context.Context, id int, req *models.UpdateUserRequest) (*models.User, error) {
	var user models.User
	
	// First, find the user
	err := r.db.WithContext(ctx).Where("id = ? AND is_active = ?", id, true).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user with ID %d not found or inactive", id)
	}
	if err != nil {
		return nil, fmt.Errorf("GORM find user for update failed: %w", err)
	}

	// Build update map for selective updates
	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Email != nil {
		updates["email"] = *req.Email
	}
	if req.Age != nil {
		updates["age"] = *req.Age
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	// Perform the update
	err = r.db.WithContext(ctx).Model(&user).Updates(updates).Error
	if err != nil {
		return nil, fmt.Errorf("GORM update user failed: %w", err)
	}

	// Reload the user to get updated values
	err = r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, fmt.Errorf("GORM reload updated user failed: %w", err)
	}

	return &user, nil
}

// DeleteUser performs soft delete using GORM
func (r *GORMRepository) DeleteUser(ctx context.Context, id int) error {
	// Soft delete by setting is_active = false
	result := r.db.WithContext(ctx).
		Model(&models.User{}).
		Where("id = ? AND is_active = ?", id, true).
		Updates(map[string]interface{}{
			"is_active":  false,
			"updated_at": time.Now(),
		})

	if result.Error != nil {
		return fmt.Errorf("GORM delete user failed: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("user with ID %d not found or already deleted", id)
	}

	return nil
}

// GetUsersByEmail searches users by email pattern using GORM
func (r *GORMRepository) GetUsersByEmail(ctx context.Context, emailPattern string) ([]*models.User, error) {
	var users []models.User
	
	// Equivalent SQL: SELECT * FROM users WHERE email ILIKE '%pattern%' AND is_active = true ORDER BY created_at DESC
	err := r.db.WithContext(ctx).
		Where("email ILIKE ? AND is_active = ?", "%"+emailPattern+"%", true).
		Order("created_at DESC").
		Find(&users).Error
	
	if err != nil {
		return nil, fmt.Errorf("GORM search users by email failed: %w", err)
	}

	// Convert to pointer slice
	result := make([]*models.User, len(users))
	for i := range users {
		result[i] = &users[i]
	}

	return result, nil
}

// CreateUserWithTransaction demonstrates transaction handling with GORM
func (r *GORMRepository) CreateUserWithTransaction(ctx context.Context, req *models.CreateUserRequest) (*models.User, error) {
	var user *models.User
	
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Check if email already exists
		var count int64
		err := tx.Model(&models.User{}).
			Where("email = ? AND is_active = ?", req.Email, true).
			Count(&count).Error
		if err != nil {
			return fmt.Errorf("GORM check email existence failed: %w", err)
		}

		if count > 0 {
			return fmt.Errorf("user with email %s already exists", req.Email)
		}

		// Create user
		user = &models.User{
			Name:     req.Name,
			Email:    req.Email,
			Age:      req.Age,
			IsActive: true,
		}

		if err := tx.Create(user).Error; err != nil {
			return fmt.Errorf("GORM create user in transaction failed: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return user, nil
}

// BatchCreateUsers demonstrates batch operations with GORM
func (r *GORMRepository) BatchCreateUsers(ctx context.Context, requests []*models.CreateUserRequest) ([]*models.User, error) {
	if len(requests) == 0 {
		return []*models.User{}, nil
	}

	users := make([]models.User, len(requests))
	for i, req := range requests {
		users[i] = models.User{
			Name:     req.Name,
			Email:    req.Email,
			Age:      req.Age,
			IsActive: true,
		}
	}

	// GORM batch insert
	err := r.db.WithContext(ctx).CreateInBatches(users, 100).Error
	if err != nil {
		return nil, fmt.Errorf("GORM batch create users failed: %w", err)
	}

	// Convert to pointer slice
	result := make([]*models.User, len(users))
	for i := range users {
		result[i] = &users[i]
	}

	return result, nil
}

// GetUserStats demonstrates complex queries with GORM
func (r *GORMRepository) GetUserStats(ctx context.Context) (map[string]interface{}, error) {
	var stats struct {
		TotalUsers   int64   `json:"total_users"`
		ActiveUsers  int64   `json:"active_users"`
		AverageAge   float64 `json:"average_age"`
	}

	// Count total users
	err := r.db.WithContext(ctx).Model(&models.User{}).Count(&stats.TotalUsers).Error
	if err != nil {
		return nil, fmt.Errorf("GORM count total users failed: %w", err)
	}

	// Count active users
	err = r.db.WithContext(ctx).Model(&models.User{}).Where("is_active = ?", true).Count(&stats.ActiveUsers).Error
	if err != nil {
		return nil, fmt.Errorf("GORM count active users failed: %w", err)
	}

	// Calculate average age of active users
	err = r.db.WithContext(ctx).Model(&models.User{}).
		Where("is_active = ?", true).
		Select("AVG(age)").
		Scan(&stats.AverageAge).Error
	if err != nil {
		return nil, fmt.Errorf("GORM calculate average age failed: %w", err)
	}

	return map[string]interface{}{
		"total_users":  stats.TotalUsers,
		"active_users": stats.ActiveUsers,
		"average_age":  stats.AverageAge,
	}, nil
}

// FindUsersWithComplexQuery demonstrates advanced GORM querying
func (r *GORMRepository) FindUsersWithComplexQuery(ctx context.Context, minAge, maxAge int, emailDomain string) ([]*models.User, error) {
	var users []models.User

	query := r.db.WithContext(ctx).Where("is_active = ? AND age BETWEEN ? AND ?", true, minAge, maxAge)
	
	if emailDomain != "" {
		query = query.Where("email LIKE ?", "%@"+emailDomain)
	}

	err := query.Order("created_at DESC").Find(&users).Error
	if err != nil {
		return nil, fmt.Errorf("GORM complex query failed: %w", err)
	}

	// Convert to pointer slice
	result := make([]*models.User, len(users))
	for i := range users {
		result[i] = &users[i]
	}

	return result, nil
}

// UpdateUserSelective demonstrates GORM's selective updates feature
func (r *GORMRepository) UpdateUserSelective(ctx context.Context, id int, updates map[string]interface{}) (*models.User, error) {
	var user models.User

	// Add updated_at to updates
	updates["updated_at"] = time.Now()

	// Perform selective update
	result := r.db.WithContext(ctx).
		Model(&user).
		Where("id = ? AND is_active = ?", id, true).
		Updates(updates)

	if result.Error != nil {
		return nil, fmt.Errorf("GORM selective update failed: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return nil, fmt.Errorf("user with ID %d not found or inactive", id)
	}

	// Reload the updated user
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, fmt.Errorf("GORM reload after selective update failed: %w", err)
	}

	return &user, nil
}