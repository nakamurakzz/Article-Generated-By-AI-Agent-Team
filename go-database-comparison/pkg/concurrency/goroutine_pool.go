package concurrency

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"time"
)

// WorkerPool represents a goroutine pool for database operations
type WorkerPool struct {
	workers    int
	jobQueue   chan Job
	results    chan Result
	wg         sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
	started    bool
	mu         sync.RWMutex
}

// Job represents a task to be executed by workers
type Job struct {
	ID       int
	TaskFunc func(context.Context) (interface{}, error)
	Timeout  time.Duration
}

// Result represents the result of a job execution
type Result struct {
	JobID    int
	Data     interface{}
	Error    error
	Duration time.Duration
}

// NewWorkerPool creates a new goroutine pool
func NewWorkerPool(ctx context.Context, workers int) *WorkerPool {
	if workers <= 0 {
		workers = runtime.NumCPU()
	}

	poolCtx, cancel := context.WithCancel(ctx)
	
	return &WorkerPool{
		workers:  workers,
		jobQueue: make(chan Job, workers*10), // Larger buffer for high-load scenarios
		results:  make(chan Result, workers*2),
		ctx:      poolCtx,
		cancel:   cancel,
	}
}

// Start initializes and starts the worker pool
func (wp *WorkerPool) Start() {
	wp.mu.Lock()
	defer wp.mu.Unlock()
	
	if wp.started {
		return
	}

	for i := 0; i < wp.workers; i++ {
		wp.wg.Add(1)
		go wp.worker(i)
	}
	
	wp.started = true
}

// worker represents a single worker goroutine
func (wp *WorkerPool) worker(id int) {
	defer wp.wg.Done()
	
	for {
		select {
		case job, ok := <-wp.jobQueue:
			if !ok {
				return // Channel closed, exit worker
			}
			
			result := wp.executeJob(job)
			
			select {
			case wp.results <- result:
			case <-wp.ctx.Done():
				return
			}
			
		case <-wp.ctx.Done():
			return
		}
	}
}

// executeJob executes a single job with timeout and error handling
func (wp *WorkerPool) executeJob(job Job) Result {
	start := time.Now()
	
	// Create job-specific context with timeout
	jobCtx := wp.ctx
	if job.Timeout > 0 {
		var cancel context.CancelFunc
		jobCtx, cancel = context.WithTimeout(wp.ctx, job.Timeout)
		defer cancel()
	}
	
	// Execute the job
	data, err := job.TaskFunc(jobCtx)
	duration := time.Since(start)
	
	return Result{
		JobID:    job.ID,
		Data:     data,
		Error:    err,
		Duration: duration,
	}
}

// Submit submits a job to the worker pool
func (wp *WorkerPool) Submit(job Job) error {
	wp.mu.RLock()
	defer wp.mu.RUnlock()
	
	if !wp.started {
		return fmt.Errorf("worker pool not started")
	}
	
	select {
	case wp.jobQueue <- job:
		return nil
	case <-wp.ctx.Done():
		return wp.ctx.Err()
	default:
		return fmt.Errorf("job queue full")
	}
}

// GetResult retrieves a result from the worker pool
func (wp *WorkerPool) GetResult() (Result, error) {
	select {
	case result := <-wp.results:
		return result, nil
	case <-wp.ctx.Done():
		return Result{}, wp.ctx.Err()
	}
}

// GetResults retrieves multiple results with timeout
func (wp *WorkerPool) GetResults(count int, timeout time.Duration) ([]Result, error) {
	results := make([]Result, 0, count)
	timeoutCtx, cancel := context.WithTimeout(wp.ctx, timeout)
	defer cancel()
	
	for i := 0; i < count; i++ {
		select {
		case result := <-wp.results:
			results = append(results, result)
		case <-timeoutCtx.Done():
			return results, fmt.Errorf("timeout waiting for results, got %d/%d", len(results), count)
		}
	}
	
	return results, nil
}

// Stop gracefully shuts down the worker pool
func (wp *WorkerPool) Stop() {
	wp.mu.Lock()
	defer wp.mu.Unlock()
	
	if !wp.started {
		return
	}
	
	wp.cancel() // Cancel context to signal workers to stop
	close(wp.jobQueue) // Close job queue
	wp.wg.Wait() // Wait for all workers to finish
	close(wp.results) // Close results channel
	wp.started = false
}

// Stats returns worker pool statistics
func (wp *WorkerPool) Stats() map[string]interface{} {
	wp.mu.RLock()
	defer wp.mu.RUnlock()
	
	return map[string]interface{}{
		"workers":       wp.workers,
		"jobs_queued":   len(wp.jobQueue),
		"results_ready": len(wp.results),
		"started":       wp.started,
	}
}

// DatabaseBenchmarkPool specialized worker pool for database benchmarking
type DatabaseBenchmarkPool struct {
	*WorkerPool
	operations map[string]int64
	durations  map[string][]time.Duration
	mu         sync.Mutex
}

// NewDatabaseBenchmarkPool creates a specialized pool for database benchmarking
func NewDatabaseBenchmarkPool(ctx context.Context, workers int) *DatabaseBenchmarkPool {
	return &DatabaseBenchmarkPool{
		WorkerPool: NewWorkerPool(ctx, workers),
		operations: make(map[string]int64),
		durations:  make(map[string][]time.Duration),
	}
}

// SubmitBenchmarkJob submits a database benchmark job
func (dbp *DatabaseBenchmarkPool) SubmitBenchmarkJob(operation string, taskFunc func(context.Context) (interface{}, error)) error {
	job := Job{
		ID:       int(time.Now().UnixNano()),
		TaskFunc: taskFunc,
		Timeout:  30 * time.Second, // Default timeout for DB operations
	}
	
	return dbp.Submit(job)
}

// RecordOperation records the result of a database operation
func (dbp *DatabaseBenchmarkPool) RecordOperation(operation string, duration time.Duration) {
	dbp.mu.Lock()
	defer dbp.mu.Unlock()
	
	dbp.operations[operation]++
	if dbp.durations[operation] == nil {
		dbp.durations[operation] = make([]time.Duration, 0)
	}
	dbp.durations[operation] = append(dbp.durations[operation], duration)
}

// GetBenchmarkStats returns comprehensive benchmark statistics
func (dbp *DatabaseBenchmarkPool) GetBenchmarkStats() map[string]interface{} {
	dbp.mu.Lock()
	defer dbp.mu.Unlock()
	
	stats := make(map[string]interface{})
	
	for operation, count := range dbp.operations {
		durations := dbp.durations[operation]
		if len(durations) == 0 {
			continue
		}
		
		var total time.Duration
		min := durations[0]
		max := durations[0]
		
		for _, d := range durations {
			total += d
			if d < min {
				min = d
			}
			if d > max {
				max = d
			}
		}
		
		avg := total / time.Duration(len(durations))
		
		stats[operation] = map[string]interface{}{
			"count":       count,
			"avg_duration": avg.String(),
			"min_duration": min.String(),
			"max_duration": max.String(),
			"total_time":   total.String(),
		}
	}
	
	return stats
}