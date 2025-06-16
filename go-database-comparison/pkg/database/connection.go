package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DatabaseConfig holds database connection configuration
type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// DefaultPostgreSQLConfig returns default PostgreSQL configuration for testing
func DefaultPostgreSQLConfig() *DatabaseConfig {
	return &DatabaseConfig{
		Host:     "localhost",
		Port:     5432,
		User:     "testuser",
		Password: "testpass",
		DBName:   "testdb",
		SSLMode:  "disable",
	}
}

// PostgreSQLDSN generates PostgreSQL connection string
func (c *DatabaseConfig) PostgreSQLDSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode)
}

// ConnectWithPQ establishes connection using lib/pq driver
func ConnectWithPQ(ctx context.Context, config *DatabaseConfig) (*sql.DB, error) {
	db, err := sql.Open("postgres", config.PostgreSQLDSN())
	if err != nil {
		return nil, fmt.Errorf("failed to open PQ connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test connection with context
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping PQ database: %w", err)
	}

	return db, nil
}

// ConnectWithSQLX establishes connection using sqlx
func ConnectWithSQLX(ctx context.Context, config *DatabaseConfig) (*sqlx.DB, error) {
	db, err := sqlx.ConnectContext(ctx, "postgres", config.PostgreSQLDSN())
	if err != nil {
		return nil, fmt.Errorf("failed to connect with SQLX: %w", err)
	}

	// Configure connection pool (same settings as PQ for fair comparison)
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping SQLX database: %w", err)
	}

	return db, nil
}

// ConnectWithGORM establishes connection using GORM
func ConnectWithGORM(ctx context.Context, config *DatabaseConfig) (*gorm.DB, error) {
	// Configure GORM with custom logger for consistent behavior
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // Disable logging for fair performance comparison
	}

	db, err := gorm.Open(postgres.Open(config.PostgreSQLDSN()), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect with GORM: %w", err)
	}

	// Get underlying sql.DB to configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB from GORM: %w", err)
	}

	// Configure connection pool (same settings for fair comparison)
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	// Test connection with context
	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping GORM database: %w", err)
	}

	return db, nil
}

// HealthCheck performs health check on database connections
func HealthCheck(ctx context.Context, config *DatabaseConfig) error {
	// Test PQ connection
	pqDB, err := ConnectWithPQ(ctx, config)
	if err != nil {
		return fmt.Errorf("PQ health check failed: %w", err)
	}
	pqDB.Close()

	// Test SQLX connection
	sqlxDB, err := ConnectWithSQLX(ctx, config)
	if err != nil {
		return fmt.Errorf("SQLX health check failed: %w", err)
	}
	sqlxDB.Close()

	// Test GORM connection
	gormDB, err := ConnectWithGORM(ctx, config)
	if err != nil {
		return fmt.Errorf("GORM health check failed: %w", err)
	}
	sqlDB, _ := gormDB.DB()
	sqlDB.Close()

	return nil
}