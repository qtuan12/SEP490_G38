using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using MockQueryable;
using MockQueryable.Moq;
using BPG.Application.IRepositories;

namespace BPG.Application.UnitTests.Helpers;

public static class MockRepositoryExtensions
{
    public static Mock<IGenericRepository<T>> SetupMockData<T>(this Mock<IGenericRepository<T>> mock, List<T> data) where T : class
    {
        mock.Setup(r => r.Query()).Returns(data.BuildMock());

        mock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<T, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Expression<Func<T, bool>> predicate, CancellationToken ct) =>
                data.AsQueryable().Where(predicate).ToList());

        mock.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<T, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Expression<Func<T, bool>> predicate, CancellationToken ct) =>
                data.AsQueryable().FirstOrDefault(predicate));

        mock.Setup(r => r.AnyAsync(It.IsAny<Expression<Func<T, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Expression<Func<T, bool>> predicate, CancellationToken ct) =>
                data.AsQueryable().Any(predicate));

        return mock;
    }
}
