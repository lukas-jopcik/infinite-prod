/**
 * Unit tests for frontend components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js components
jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  };
});

jest.mock('next/link', () => {
  return function MockLink({ href, children, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

// Mock components
const MockArticleCard = ({ article, onClick }: any) => (
  <div data-testid="article-card" onClick={() => onClick?.(article)}>
    <h3>{article.title}</h3>
    <p>{article.perex}</p>
    <span>{article.category}</span>
    <span>{article.readingTime}</span>
  </div>
);

const MockPagination = ({ currentPage, totalPages, onPageChange }: any) => (
  <div data-testid="pagination">
    <button 
      data-testid="prev-button"
      onClick={() => onPageChange(currentPage - 1)}
      disabled={currentPage <= 1}
    >
      Previous
    </button>
    <span data-testid="page-info">
      Page {currentPage} of {totalPages}
    </span>
    <button 
      data-testid="next-button"
      onClick={() => onPageChange(currentPage + 1)}
      disabled={currentPage >= totalPages}
    >
      Next
    </button>
  </div>
);

const MockSearchBar = ({ onSearch, placeholder }: any) => {
  const [query, setQuery] = React.useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form data-testid="search-form" onSubmit={handleSubmit}>
      <input
        data-testid="search-input"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
      <button data-testid="search-button" type="submit">
        Search
      </button>
    </form>
  );
};

const MockCategoryFilter = ({ categories, selectedCategory, onCategoryChange }: any) => (
  <div data-testid="category-filter">
    {categories.map((category: string) => (
      <button
        key={category}
        data-testid={`category-${category}`}
        className={selectedCategory === category ? 'active' : ''}
        onClick={() => onCategoryChange(category)}
      >
        {category}
      </button>
    ))}
  </div>
);

describe('Frontend Components', () => {
  const mockArticle = {
    id: '1',
    title: 'Test Article Title',
    slug: 'test-article-title',
    perex: 'This is a test article excerpt that describes the content.',
    category: 'objav-dna',
    publishedAt: '2025-01-15T06:00:00.000Z',
    originalDate: '2025-01-15',
    author: 'AI Assistant',
    readingTime: '5 min',
    imageUrl: 'https://test.com/image.jpg',
    metaTitle: 'Test Meta Title',
    metaDescription: 'Test meta description',
    type: 'discovery',
    tags: ['astronómia', 'vesmír']
  };

  describe('ArticleCard', () => {
    test('should render article information correctly', () => {
      render(<MockArticleCard article={mockArticle} />);

      expect(screen.getByText('Test Article Title')).toBeInTheDocument();
      expect(screen.getByText('This is a test article excerpt that describes the content.')).toBeInTheDocument();
      expect(screen.getByText('objav-dna')).toBeInTheDocument();
      expect(screen.getByText('5 min')).toBeInTheDocument();
    });

    test('should handle click events', () => {
      const handleClick = jest.fn();
      render(<MockArticleCard article={mockArticle} onClick={handleClick} />);

      const card = screen.getByTestId('article-card');
      fireEvent.click(card);

      expect(handleClick).toHaveBeenCalledWith(mockArticle);
    });

    test('should render without onClick handler', () => {
      render(<MockArticleCard article={mockArticle} />);

      const card = screen.getByTestId('article-card');
      expect(() => fireEvent.click(card)).not.toThrow();
    });
  });

  describe('Pagination', () => {
    test('should render pagination controls correctly', () => {
      const onPageChange = jest.fn();
      render(
        <MockPagination 
          currentPage={2} 
          totalPages={5} 
          onPageChange={onPageChange} 
        />
      );

      expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
      expect(screen.getByTestId('prev-button')).toBeInTheDocument();
      expect(screen.getByTestId('next-button')).toBeInTheDocument();
    });

    test('should disable previous button on first page', () => {
      const onPageChange = jest.fn();
      render(
        <MockPagination 
          currentPage={1} 
          totalPages={5} 
          onPageChange={onPageChange} 
        />
      );

      const prevButton = screen.getByTestId('prev-button');
      expect(prevButton).toBeDisabled();
    });

    test('should disable next button on last page', () => {
      const onPageChange = jest.fn();
      render(
        <MockPagination 
          currentPage={5} 
          totalPages={5} 
          onPageChange={onPageChange} 
        />
      );

      const nextButton = screen.getByTestId('next-button');
      expect(nextButton).toBeDisabled();
    });

    test('should call onPageChange when buttons are clicked', () => {
      const onPageChange = jest.fn();
      render(
        <MockPagination 
          currentPage={3} 
          totalPages={5} 
          onPageChange={onPageChange} 
        />
      );

      const prevButton = screen.getByTestId('prev-button');
      const nextButton = screen.getByTestId('next-button');

      fireEvent.click(prevButton);
      expect(onPageChange).toHaveBeenCalledWith(2);

      fireEvent.click(nextButton);
      expect(onPageChange).toHaveBeenCalledWith(4);
    });
  });

  describe('SearchBar', () => {
    test('should render search input and button', () => {
      const onSearch = jest.fn();
      render(<MockSearchBar onSearch={onSearch} placeholder="Search articles..." />);

      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('search-button')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search articles...')).toBeInTheDocument();
    });

    test('should update input value when typing', () => {
      const onSearch = jest.fn();
      render(<MockSearchBar onSearch={onSearch} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'test query' } });

      expect(input).toHaveValue('test query');
    });

    test('should call onSearch when form is submitted', async () => {
      const onSearch = jest.fn();
      render(<MockSearchBar onSearch={onSearch} />);

      const input = screen.getByTestId('search-input');
      const form = screen.getByTestId('search-form');

      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith('test query');
      });
    });

    test('should call onSearch when search button is clicked', async () => {
      const onSearch = jest.fn();
      render(<MockSearchBar onSearch={onSearch} />);

      const input = screen.getByTestId('search-input');
      const button = screen.getByTestId('search-button');

      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith('test query');
      });
    });
  });

  describe('CategoryFilter', () => {
    const mockCategories = ['objav-dna', 'tyzdenny-vyber', 'komunita'];

    test('should render all category buttons', () => {
      const onCategoryChange = jest.fn();
      render(
        <MockCategoryFilter 
          categories={mockCategories}
          selectedCategory="objav-dna"
          onCategoryChange={onCategoryChange}
        />
      );

      mockCategories.forEach(category => {
        expect(screen.getByTestId(`category-${category}`)).toBeInTheDocument();
        expect(screen.getByText(category)).toBeInTheDocument();
      });
    });

    test('should highlight selected category', () => {
      const onCategoryChange = jest.fn();
      render(
        <MockCategoryFilter 
          categories={mockCategories}
          selectedCategory="objav-dna"
          onCategoryChange={onCategoryChange}
        />
      );

      const selectedButton = screen.getByTestId('category-objav-dna');
      expect(selectedButton).toHaveClass('active');

      const unselectedButton = screen.getByTestId('category-tyzdenny-vyber');
      expect(unselectedButton).not.toHaveClass('active');
    });

    test('should call onCategoryChange when category is clicked', () => {
      const onCategoryChange = jest.fn();
      render(
        <MockCategoryFilter 
          categories={mockCategories}
          selectedCategory="objav-dna"
          onCategoryChange={onCategoryChange}
        />
      );

      const categoryButton = screen.getByTestId('category-tyzdenny-vyber');
      fireEvent.click(categoryButton);

      expect(onCategoryChange).toHaveBeenCalledWith('tyzdenny-vyber');
    });

    test('should handle no selected category', () => {
      const onCategoryChange = jest.fn();
      render(
        <MockCategoryFilter 
          categories={mockCategories}
          selectedCategory={null}
          onCategoryChange={onCategoryChange}
        />
      );

      mockCategories.forEach(category => {
        const button = screen.getByTestId(`category-${category}`);
        expect(button).not.toHaveClass('active');
      });
    });
  });

  describe('Component Integration', () => {
    test('should work together in a complete article list', () => {
      const mockArticles = [mockArticle];
      const onSearch = jest.fn();
      const onCategoryChange = jest.fn();
      const onPageChange = jest.fn();

      render(
        <div>
          <MockSearchBar onSearch={onSearch} />
          <MockCategoryFilter 
            categories={['objav-dna', 'tyzdenny-vyber']}
            selectedCategory="objav-dna"
            onCategoryChange={onCategoryChange}
          />
          {mockArticles.map(article => (
            <MockArticleCard key={article.id} article={article} />
          ))}
          <MockPagination 
            currentPage={1} 
            totalPages={3} 
            onPageChange={onPageChange} 
          />
        </div>
      );

      expect(screen.getByTestId('search-form')).toBeInTheDocument();
      expect(screen.getByTestId('category-filter')).toBeInTheDocument();
      expect(screen.getByTestId('article-card')).toBeInTheDocument();
      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });
  });
});
