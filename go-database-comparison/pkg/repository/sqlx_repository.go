package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	"go-database-comparison/pkg/models"
)

// SQLXRepository implements repository pattern using sqlx
type SQLXRepository struct {
	db *sqlx.DB
}

// NewSQLXRepository creates a new SQLX repository instance
func NewSQLXRepository(db *sqlx.DB) *SQLXRepository {
	return &SQLXRepository{db: db}
}

// CreateUser creates a new user using sqlx with struct mapping
func (r *SQLXRepository) CreateUser(ctx context.Context, req *models.CreateUserRequest) (*models.User, error) {
	// Same SQL as PQ for fair comparison
	query := `
		INSERT INTO users (name, email, age, created_at, updated_at, is_active)
		VALUES (:name, :email, :age, :created_at, :updated_at, :is_active)
		RETURNING id, name, email, age, created_at, updated_at, is_active`

	now := time.Now()
	params := map[string]interface{}{
		"name":       req.Name,
		"email":      req.Email,
		"age":        req.Age,
		"created_at": now,
		"updated_at": now,
		"is_active":  true,
	}

	// Use NamedQuery for better parameter binding
	rows, err := r.db.NamedQueryContext(ctx, query, params)
	if err != nil {
		return nil, fmt.Errorf("SQLX create user failed: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, fmt.Errorf("SQLX create user: no rows returned")
	}

	var user models.User
	if err := rows.StructScan(&user); err != nil {
		return nil, fmt.Errorf("SQLX struct scan failed: %w", err)
	}

	return &user, nil
}

// GetUserByID retrieves a user by ID using sqlx struct mapping
func (r *SQLXRepository) GetUserByID(ctx context.Context, id int) (*models.User, error) {
	// Same SQL as PQ for fair comparison
	query := `
		SELECT id, name, email, age, created_at, updated_at, is_active
		FROM users
		WHERE id = $1 AND is_active = true`

	var user models.User
	err := r.db.GetContext(ctx, &user, query, id)
	
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user with ID %d not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("SQLX get user failed: %w", err)
	}

	return &user, nil
}

// GetAllUsers retrieves all active users using sqlx Select
func (r *SQLXRepository) GetAllUsers(ctx context.Context, limit, offset int) ([]*models.User, error) {
	// Same SQL as PQ for fair comparison
	query := `
		SELECT id, name, email, age, created_at, updated_at, is_active
		FROM users
		WHERE is_active = true
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2`

	var users []models.User
	err := r.db.SelectContext(ctx, &users, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("SQLX get all users failed: %w", err)
	}

	// Convert to pointer slice for consistent interface
	result := make([]*models.User, len(users))
	for i := range users {
		result[i] = &users[i]
	}

	return result, nil
}

// UpdateUser updates a user using sqlx with dynamic query building
func (r *SQLXRepository) UpdateUser(ctx context.Context, id int, req *models.UpdateUserRequest) (*models.User, error) {
	// Dynamic query building for partial updates (same logic as PQ)
	setParts := []string{"updated_at = :updated_at"}
	params := map[string]interface{}{
		"updated_at": time.Now(),
		"id":         id,
	}

	if req.Name != nil {
		setParts = append(setParts, "name = :name")
		params["name"] = *req.Name
	}
	if req.Email != nil {
		setParts = append(setParts, "email = :email")
		params["email"] = *req.Email
	}
	if req.Age != nil {
		setParts = append(setParts, "age = :age")
		params["age"] = *req.Age
	}
	if req.IsActive != nil {
		setParts = append(setParts, "is_active = :is_active")
		params["is_active"] = *req.IsActive
	}

	// Build SET clause
	setClause := ""
	for i, part := range setParts {
		if i > 0 {
			setClause += ", "
		}
		setClause += part
	}

	query := fmt.Sprintf(`
		UPDATE users
		SET %s
		WHERE id = :id AND is_active = true
		RETURNING id, name, email, age, created_at, updated_at, is_active`,
		setClause)

	rows, err := r.db.NamedQueryContext(ctx, query, params)
	if err != nil {
		return nil, fmt.Errorf("SQLX update user failed: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, fmt.Errorf("user with ID %d not found or inactive", id)
	}

	var user models.User
	if err := rows.StructScan(&user); err != nil {
		return nil, fmt.Errorf("SQLX update scan failed: %w", err)
	}

	return &user, nil
}

// DeleteUser performs soft delete using sqlx
func (r *SQLXRepository) DeleteUser(ctx context.Context, id int) error {
	// Same SQL as PQ for fair comparison
	query := `
		UPDATE users
		SET is_active = false, updated_at = $1
		WHERE id = $2 AND is_active = true`

	result, err := r.db.ExecContext(ctx, query, time.Now(), id)
	if err != nil {
		return fmt.Errorf("SQLX delete user failed: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("SQLX get rows affected failed: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("user with ID %d not found or already deleted", id)
	}

	return nil
}

// GetUsersByEmail searches users by email pattern using sqlx
func (r *SQLXRepository) GetUsersByEmail(ctx context.Context, emailPattern string) ([]*models.User, error) {
	// Same SQL as PQ for fair comparison
	query := `
		SELECT id, name, email, age, created_at, updated_at, is_active
		FROM users
		WHERE email ILIKE $1 AND is_active = true
		ORDER BY created_at DESC`

	var users []models.User
	err := r.db.SelectContext(ctx, &users, query, "%"+emailPattern+"%")
	if err != nil {
		return nil, fmt.Errorf("SQLX search users by email failed: %w", err)
	}

	// Convert to pointer slice
	result := make([]*models.User, len(users))
	for i := range users {
		result[i] = &users[i]
	}

	return result, nil
}

// CreateUserWithTransaction demonstrates transaction handling with sqlx
func (r *SQLXRepository) CreateUserWithTransaction(ctx context.Context, req *models.CreateUserRequest) (*models.User, error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("SQLX begin transaction failed: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		} else if err != nil {
			tx.Rollback()
		}
	}()

	// Check if email already exists (same logic as PQ)
	var exists bool
	checkQuery := "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND is_active = true)"
	err = tx.GetContext(ctx, &exists, checkQuery, req.Email)
	if err != nil {
		return nil, fmt.Errorf("SQLX check email existence failed: %w", err)
	}

	if exists {
		return nil, fmt.Errorf("user with email %s already exists", req.Email)
	}

	// Create user using named parameters
	insertQuery := `
		INSERT INTO users (name, email, age, created_at, updated_at, is_active)
		VALUES (:name, :email, :age, :created_at, :updated_at, :is_active)
		RETURNING id, name, email, age, created_at, updated_at, is_active`

	now := time.Now()
	params := map[string]interface{}{
		"name":       req.Name,
		"email":      req.Email,
		"age":        req.Age,
		"created_at": now,
		"updated_at": now,
		"is_active":  true,
	}

	rows, err := tx.NamedQuery(insertQuery, params)
	if err != nil {
		return nil, fmt.Errorf("SQLX create user in transaction failed: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, fmt.Errorf("SQLX create user: no rows returned")
	}

	var user models.User
	if err := rows.StructScan(&user); err != nil {
		return nil, fmt.Errorf("SQLX transaction scan failed: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("SQLX commit transaction failed: %w", err)
	}

	return &user, nil
}

// BatchCreateUsers demonstrates batch operations with sqlx
func (r *SQLXRepository) BatchCreateUsers(ctx context.Context, users []*models.CreateUserRequest) ([]*models.User, error) {
	if len(users) == 0 {
		return []*models.User{}, nil
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("SQLX batch begin transaction failed: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		} else if err != nil {
			tx.Rollback()
		}
	}()

	query := `
		INSERT INTO users (name, email, age, created_at, updated_at, is_active)
		VALUES (:name, :email, :age, :created_at, :updated_at, :is_active)`

	now := time.Now()
	params := make([]map[string]interface{}, len(users))
	for i, user := range users {
		params[i] = map[string]interface{}{
			"name":       user.Name,
			"email":      user.Email,
			"age":        user.Age,
			"created_at": now,
			"updated_at": now,
			"is_active":  true,
		}
	}

	// Use NamedExec for batch insert
	_, err = tx.NamedExec(query, params)
	if err != nil {
		return nil, fmt.Errorf("SQLX batch insert failed: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("SQLX batch commit failed: %w", err)
	}

	// Return the created users (simplified - in production, you'd want to return actual IDs)
	result := make([]*models.User, len(users))
	for i, user := range users {
		result[i] = &models.User{
			Name:      user.Name,
			Email:     user.Email,
			Age:       user.Age,
			CreatedAt: now,
			UpdatedAt: now,
			IsActive:  true,
		}
	}

	return result, nil
}