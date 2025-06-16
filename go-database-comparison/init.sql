-- Database initialization for Go database comparison
-- Creating test tables with realistic enterprise data structure

-- Enable pg_stat_statements extension for performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Users table for basic CRUD operations
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    age INTEGER CHECK (age >= 0 AND age <= 150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Orders table for relationship and transaction testing
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shipped_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Order items for complex queries and joins
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(8,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- Performance test table for bulk operations
CREATE TABLE performance_test (
    id SERIAL PRIMARY KEY,
    data_field VARCHAR(500),
    numeric_field INTEGER,
    timestamp_field TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    json_field JSONB
);

-- Indexes for performance testing
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_performance_test_numeric ON performance_test(numeric_field);
CREATE INDEX idx_performance_test_json ON performance_test USING GIN(json_field);

-- Sample data for initial testing
INSERT INTO users (name, email, age) VALUES 
('Alice Johnson', 'alice@example.com', 28),
('Bob Smith', 'bob@example.com', 35),
('Carol Davis', 'carol@example.com', 42),
('David Wilson', 'david@example.com', 31),
('Emma Brown', 'emma@example.com', 27);

INSERT INTO orders (user_id, total_amount, status) VALUES 
(1, 299.99, 'delivered'),
(1, 149.50, 'pending'),
(2, 89.99, 'shipped'),
(3, 449.99, 'confirmed'),
(4, 199.99, 'cancelled');

INSERT INTO order_items (order_id, product_name, quantity, unit_price) VALUES 
(1, 'Laptop Computer', 1, 299.99),
(2, 'Wireless Mouse', 2, 74.75),
(3, 'USB Cable', 3, 29.99),
(4, 'Monitor Stand', 1, 449.99),
(5, 'Keyboard', 1, 199.99);

-- Stored procedure for transaction testing
CREATE OR REPLACE FUNCTION create_order_with_items(
    p_user_id INTEGER,
    p_items JSONB
) RETURNS INTEGER AS $$
DECLARE
    v_order_id INTEGER;
    v_item JSONB;
    v_total_amount DECIMAL(10,2) := 0;
BEGIN
    -- Create order
    INSERT INTO orders (user_id, total_amount, status)
    VALUES (p_user_id, 0, 'pending')
    RETURNING id INTO v_order_id;
    
    -- Add items and calculate total
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO order_items (order_id, product_name, quantity, unit_price)
        VALUES (
            v_order_id,
            v_item->>'product_name',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price')::DECIMAL
        );
        
        v_total_amount := v_total_amount + 
            ((v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL);
    END LOOP;
    
    -- Update order total
    UPDATE orders SET total_amount = v_total_amount WHERE id = v_order_id;
    
    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate test data for performance benchmarks
CREATE OR REPLACE FUNCTION generate_performance_data(p_count INTEGER) RETURNS VOID AS $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..p_count LOOP
        INSERT INTO performance_test (data_field, numeric_field, json_field)
        VALUES (
            'Test data ' || i || ' - ' || md5(random()::text),
            (random() * 1000000)::INTEGER,
            jsonb_build_object(
                'id', i,
                'random_value', random(),
                'timestamp', now(),
                'metadata', jsonb_build_object('batch', 'performance_test', 'iteration', i)
            )
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Views for complex query testing
CREATE VIEW user_order_summary AS
SELECT 
    u.id,
    u.name,
    u.email,
    COUNT(o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_spent,
    MAX(o.order_date) as last_order_date
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.email;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO testuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO testuser;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO testuser;