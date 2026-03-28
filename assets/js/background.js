// Background — picks one random canoe image per page load
(function () {
  const images = [
    '2008/1.jpg', '2008/2.JPG', '2008/3.JPG', '2008/4.JPG', '2008/5.JPG',
    '2009/1.JPG', '2009/2.JPG', '2009/3.JPG', '2009/4.JPG', '2009/5.JPG', '2009/6.JPG', '2009/7.JPG',
    '2010/1.JPG', '2010/2.JPG', '2010/3.JPG', '2010/4.JPG', '2010/5.JPG',
    '2013/1.JPG', '2013/2.JPG', '2013/3.JPG', '2013/4.JPG', '2013/5.JPG',
    '2014/1.JPG', '2014/2.JPG',
    '2015/1.JPG',
    '2016/1.JPG', '2016/2.JPG', '2016/3.JPG', '2016/4.JPG', '2016/5.jpg',
    '2017/1.JPG', '2017/2.JPG', '2017/3.JPG', '2017/4.JPG', '2017/5.JPG', '2017/6.jpg', '2017/7.jpg',
    '2018/1.JPG', '2018/2.JPG', '2018/3.jpeg', '2018/4.jpeg', '2018/5.jpeg',
    '2019/1.JPG', '2019/2.JPG', '2019/3.JPG', '2019/4.jpg', '2019/5.jpg',
    '2020/1.jpg', '2020/2.jpg', '2020/3.jpg',
    '2021/1.jpeg', '2021/2.jpeg', '2021/3.jpg',
    '2022/1.jpeg', '2022/2.jpg', '2022/3.jpeg', '2022/4.jpg', '2022/5.jpeg',
    '2023/1.jpeg', '2023/2.jpg', '2023/3.jpeg', '2023/4.jpg', '2023/5.jpeg',
    '2024/1.jpeg', '2024/2.jpeg', '2024/3.jpg', '2024/4.jpg', '2024/5.jpg', '2024/6.jpg',
    '2025/1.jpeg', '2025/2.jpeg', '2025/3.JPG', '2025/4.JPG'
  ];

  var pick = images[Math.floor(Math.random() * images.length)];

  var container = document.createElement('div');
  container.className = 'bg-slideshow';
  container.setAttribute('aria-hidden', 'true');

  var img = document.createElement('img');
  img.src = 'assets/img/canoes/' + pick;
  img.alt = '';
  img.onload = function () { img.classList.add('active'); };

  container.appendChild(img);
  document.body.prepend(container);
})();
