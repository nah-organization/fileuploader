FROM mysql:5.7

COPY ./my.cnf /etc/mysql/conf.d/my.cnf
COPY ./init.sql /docker-entrypoint-initdb.d/init.sql
CMD ["mysqld"]
