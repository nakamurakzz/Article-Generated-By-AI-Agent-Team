package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"go-database-comparison/pkg/models"
)

// PQRepository implements repository pattern using lib/pq
type PQRepository struct {
	db *sql.DB
}

// NewPQRepository creates a new PQ repository instance
func NewPQRepository(db *sql.DB) *PQRepository {
	return &PQRepository{db: db}
}

// CreateUser creates a new user using raw SQL with lib/pq
func (r *PQRepository) CreateUser(ctx context.Context, req *models.CreateUserRequest) (*models.User, error) {
	// Use prepared statement for security and performance
	query := `
		INSERT INTO users (name, email, age, created_at, updated_at, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, email, age, created_at, updated_at, is_active`

	now := time.Now()
	user := &models.User{}

	err := r.db.QueryRowContext(ctx, query,
		req.Name, req.Email, req.Age, now, now, true,
	).Scan(
		&user.ID, &user.Name, &user.Email, &user.Age,
		&user.CreatedAt, &user.UpdatedAt, &user.IsActive,
	)

	if err != nil {
		return nil, fmt.Errorf("PQ create user failed: %w", err)
	}

	return user, nil
}

// GetUserByID retrieves a user by ID using lib/pq
func (r *PQRepository) GetUserByID(ctx context.Context, id int) (*models.User, error) {
	query := `
		SELECT id, name, email, age, created_at, updated_at, is_active
		FROM users
		WHERE id = $1 AND is_active = true`

	user := &models.User{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID, &user.Name, &user.Email, &user.Age,
		&user.CreatedAt, &user.UpdatedAt, &user.IsActive,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user with ID %d not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("PQ get user failed: %w", err)
	}

	return user, nil
}

// GetAllUsers retrieves all active users using lib/pq
func (r *PQRepository) GetAllUsers(ctx context.Context, limit, offset int) ([]*models.User, error) {
	query := `
		SELECT id, name, email, age, created_at, updated_at, is_active
		FROM users
		WHERE is_active = true
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2`

	rows, err := r.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("PQ get all users failed: %w", err)
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		user := &models.User{}
		err := rows.Scan(
			&user.ID, &user.Name, &user.Email, &user.Age,
			&user.CreatedAt, &user.UpdatedAt, &user.IsActive,
		)
		if err != nil {
			return nil, fmt.Errorf("PQ scan user failed: %w", err)
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("PQ rows iteration failed: %w", err)
	}

	return users, nil
}

// UpdateUser updates a user using lib/pq with dynamic query building
func (r *PQRepository) UpdateUser(ctx context.Context, id int, req *models.UpdateUserRequest) (*models.User, error) {
	// Dynamic query building for partial updates
	setParts := []string{"updated_at = $1"}
	args := []interface{}{time.Now()}
	argCount := 2

	if req.Name != nil {
		setParts = append(setParts, fmt.Sprintf("name = $%d", argCount))
		args = append(args, *req.Name)
		argCount++
	}
	if req.Email != nil {
		setParts = append(setParts, fmt.Sprintf("email = $%d", argCount))
		args = append(args, *req.Email)
		argCount++
	}
	if req.Age != nil {
		setParts = append(setParts, fmt.Sprintf("age = $%d", argCount))
		args = append(args, *req.Age)
		argCount++
	}
	if req.IsActive != nil {
		setParts = append(setParts, fmt.Sprintf("is_active = $%d", argCount))
		args = append(args, *req.IsActive)
		argCount++
	}

	query := fmt.Sprintf(`
		UPDATE users
		SET %s
		WHERE id = $%d AND is_active = true
		RETURNING id, name, email, age, created_at, updated_at, is_active`,
		fmt.Sprintf("%s", setParts[0]),
		argCount)

	// Build the complete SET clause
	if len(setParts) > 1 {
		setClause := ""
		for i, part := range setParts {
			if i > 0 {
				setClause += ", "
			}
			setClause += part
		}
		query = fmt.Sprintf(`
			UPDATE users
			SET %s
			WHERE id = $%d AND is_active = true
			RETURNING id, name, email, age, created_at, updated_at, is_active`,
			setClause, argCount)
	}

	args = append(args, id)

	user := &models.User{}
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&user.ID, &user.Name, &user.Email, &user.Age,
		&user.CreatedAt, &user.UpdatedAt, &user.IsActive,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user with ID %d not found or inactive", id)
	}
	if err != nil {
		return nil, fmt.Errorf("PQ update user failed: %w", err)
	}

	return user, nil
}

// DeleteUser performs soft delete using lib/pq
func (r *PQRepository) DeleteUser(ctx context.Context, id int) error {
	query := `
		UPDATE users
		SET is_active = false, updated_at = $1
		WHERE id = $2 AND is_active = true`

	result, err := r.db.ExecContext(ctx, query, time.Now(), id)
	if err != nil {
		return fmt.Errorf("PQ delete user failed: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("PQ get rows affected failed: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("user with ID %d not found or already deleted", id)
	}

	return nil
}

// GetUsersByEmail searches users by email pattern using lib/pq
func (r *PQRepository) GetUsersByEmail(ctx context.Context, emailPattern string) ([]*models.User, error) {
	query := `
		SELECT id, name, email, age, created_at, updated_at, is_active
		FROM users
		WHERE email ILIKE $1 AND is_active = true
		ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, query, "%"+emailPattern+"%")
	if err != nil {
		return nil, fmt.Errorf("PQ search users by email failed: %w", err)
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		user := &models.User{}
		err := rows.Scan(
			&user.ID, &user.Name, &user.Email, &user.Age,
			&user.CreatedAt, &user.UpdatedAt, &user.IsActive,
		)
		if err != nil {
			return nil, fmt.Errorf("PQ scan user failed: %w", err)
		}
		users = append(users, user)
	}

	return users, rows.Err()
}

// CreateUserWithTransaction demonstrates transaction handling with lib/pq
func (r *PQRepository) CreateUserWithTransaction(ctx context.Context, req *models.CreateUserRequest) (*models.User, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("PQ begin transaction failed: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		} else if err != nil {
			tx.Rollback()
		}
	}()

	// Check if email already exists
	var exists bool
	checkQuery := "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND is_active = true)"
	err = tx.QueryRowContext(ctx, checkQuery, req.Email).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("PQ check email existence failed: %w", err)
	}

	if exists {
		return nil, fmt.Errorf("user with email %s already exists", req.Email)
	}

	// Create user
	insertQuery := `
		INSERT INTO users (name, email, age, created_at, updated_at, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, email, age, created_at, updated_at, is_active`

	now := time.Now()
	user := &models.User{}

	err = tx.QueryRowContext(ctx, insertQuery,
		req.Name, req.Email, req.Age, now, now, true,
	).Scan(
		&user.ID, &user.Name, &user.Email, &user.Age,
		&user.CreatedAt, &user.UpdatedAt, &user.IsActive,
	)

	if err != nil {
		return nil, fmt.Errorf("PQ create user in transaction failed: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("PQ commit transaction failed: %w", err)
	}

	return user, nil
}