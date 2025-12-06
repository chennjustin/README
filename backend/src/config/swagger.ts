import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Book Rental System API',
    version: '1.0.0',
    description: 'API documentation for the Book Rental System backend',
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 3000}`,
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for admin authentication. Format: Bearer {token}',
      },
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
            description: 'Response data',
          },
        },
        required: ['success', 'data'],
      },
      ApiError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'INVALID_INPUT',
              },
              message: {
                type: 'string',
                example: 'Invalid input parameters',
              },
              details: {
                type: 'object',
                description: 'Additional error details',
              },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
      },
      Book: {
        type: 'object',
        properties: {
          book_id: {
            type: 'integer',
            example: 1,
          },
          name: {
            type: 'string',
            example: 'The Great Gatsby',
          },
          author: {
            type: 'string',
            example: 'F. Scott Fitzgerald',
          },
          publisher: {
            type: 'string',
            example: 'Scribner',
          },
          price: {
            type: 'number',
            example: 15.99,
          },
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category_id: {
                  type: 'integer',
                },
                name: {
                  type: 'string',
                },
              },
            },
          },
          available_count: {
            type: 'integer',
            example: 5,
          },
          discount_rate: {
            type: 'number',
            example: 0.9,
            nullable: true,
          },
          estimated_min_rental_price: {
            type: 'number',
            example: 14.39,
            nullable: true,
          },
        },
      },
      BookDetail: {
        allOf: [
          { $ref: '#/components/schemas/Book' },
          {
            type: 'object',
            properties: {
              copies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    book_condition: {
                      type: 'string',
                      enum: ['Good', 'Fair', 'Poor'],
                    },
                    rental_price: {
                      type: 'number',
                    },
                    available_count: {
                      type: 'integer',
                    },
                    discount_rate: {
                      type: 'number',
                    },
                    discounted_rental_price: {
                      type: 'number',
                    },
                  },
                },
              },
            },
          },
        ],
      },
      Member: {
        type: 'object',
        properties: {
          member_id: {
            type: 'integer',
            example: 1,
          },
          name: {
            type: 'string',
            example: 'John Doe',
          },
          phone: {
            type: 'string',
            example: '0912345678',
          },
          email: {
            type: 'string',
            example: 'john@example.com',
          },
          balance: {
            type: 'number',
            example: 1000.0,
          },
          status: {
            type: 'string',
            enum: ['Active', 'Inactive', 'Suspended'],
            example: 'Active',
          },
          level_id: {
            type: 'integer',
            example: 1,
          },
          discount_rate: {
            type: 'number',
            example: 0.9,
          },
          max_book_allowed: {
            type: 'integer',
            example: 5,
          },
          hold_days: {
            type: 'integer',
            example: 7,
          },
          active_loans: {
            type: 'integer',
            example: 2,
          },
        },
      },
      Loan: {
        type: 'object',
        properties: {
          loan_id: {
            type: 'integer',
            example: 1,
          },
          final_price: {
            type: 'number',
            example: 50.0,
          },
          book_id: {
            type: 'integer',
            example: 1,
          },
          copies_serial: {
            type: 'integer',
            example: 1,
          },
          date_out: {
            type: 'string',
            format: 'date',
            example: '2024-01-15',
          },
          due_date: {
            type: 'string',
            format: 'date',
            example: '2024-01-22',
          },
          return_date: {
            type: 'string',
            format: 'date',
            nullable: true,
            example: null,
          },
          rental_fee: {
            type: 'number',
            example: 25.0,
          },
          renew_cnt: {
            type: 'integer',
            example: 0,
          },
          book_name: {
            type: 'string',
            example: 'The Great Gatsby',
          },
          author: {
            type: 'string',
            example: 'F. Scott Fitzgerald',
          },
          publisher: {
            type: 'string',
            example: 'Scribner',
          },
          book_condition: {
            type: 'string',
            enum: ['Good', 'Fair', 'Poor'],
            example: 'Good',
          },
          add_fee_total: {
            type: 'number',
            example: 0,
          },
        },
      },
      Reservation: {
        type: 'object',
        properties: {
          reservation_id: {
            type: 'integer',
            example: 1,
          },
          member_id: {
            type: 'integer',
            example: 1,
          },
          reserve_date: {
            type: 'string',
            format: 'date',
            example: '2024-01-15',
          },
          pickup_date: {
            type: 'string',
            format: 'date',
            nullable: true,
            example: null,
          },
          status: {
            type: 'string',
            enum: ['Active', 'Fulfilled', 'Cancelled'],
            example: 'Active',
          },
          books: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                book_id: {
                  type: 'integer',
                },
                name: {
                  type: 'string',
                },
                author: {
                  type: 'string',
                },
                publisher: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
      Admin: {
        type: 'object',
        properties: {
          admin_id: {
            type: 'integer',
            example: 1,
          },
          name: {
            type: 'string',
            example: 'Admin User',
          },
          phone: {
            type: 'string',
            example: '0912345678',
          },
          role: {
            type: 'string',
            example: 'Manager',
          },
        },
      },
      TopBook: {
        type: 'object',
        properties: {
          book_id: {
            type: 'integer',
            example: 1,
          },
          name: {
            type: 'string',
            example: 'The Great Gatsby',
          },
          author: {
            type: 'string',
            example: 'F. Scott Fitzgerald',
          },
          publisher: {
            type: 'string',
            example: 'Scribner',
          },
          borrow_count: {
            type: 'integer',
            example: 50,
          },
        },
      },
      TopCategory: {
        type: 'object',
        properties: {
          category_id: {
            type: 'integer',
            example: 1,
          },
          name: {
            type: 'string',
            example: 'Fiction',
          },
          borrow_count: {
            type: 'integer',
            example: 100,
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Books',
      description: 'Book search and detail endpoints',
    },
    {
      name: 'Members',
      description: 'Member profile and loan management endpoints',
    },
    {
      name: 'Reservations',
      description: 'Book reservation endpoints',
    },
    {
      name: 'Admin',
      description: 'Administrative endpoints (requires authentication)',
    },
    {
      name: 'Statistics',
      description: 'Statistics and analytics endpoints',
    },
    {
      name: 'Health',
      description: 'Health check endpoint',
    },
  ],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/server.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

